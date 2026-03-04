// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MockUSDC} from "./helpers/MockUSDC.sol";

/// @title InkdHandler — Actor handler for invariant tests
contract InkdHandler is Test {
    InkdToken public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address[] public actors;
    uint256 public ghostProjectCount;

    constructor(InkdToken _token, InkdTreasury _treasury, InkdRegistry _registry) {
        token = _token;
        treasury = _treasury;
        registry = _registry;

        for (uint256 i = 0; i < 3; i++) {
            address a = makeAddr(string(abi.encodePacked("actor-", vm.toString(i))));
            actors.push(a);
        }
    }

    function createProject(uint256 actorSeed, uint256 nameSeed) external {
        address actor = actors[actorSeed % actors.length];
        string memory name = string(abi.encodePacked("proj-", vm.toString(nameSeed)));
        if (registry.nameTaken(name)) return;

        vm.prank(actor);
        try registry.createProject(name, "handler", "MIT", true, "", false, "") {
            ghostProjectCount++;
        } catch {}
    }

    function pushVersion(uint256 actorSeed, uint256 projectIdSeed) external {
        uint256 count = registry.projectCount();
        if (count == 0) return;

        address actor = actors[actorSeed % actors.length];
        uint256 projectId = (projectIdSeed % count) + 1;

        InkdRegistry.Project memory p = registry.getProject(projectId);
        if (p.owner != actor && !registry.isCollaborator(projectId, actor)) return;

        vm.prank(actor);
        try registry.pushVersion(projectId, "ar://fuzz", "1.0", "inv") {} catch {}
    }
}

/// @title InkdInvariantTest — Invariant tests for the Inkd Protocol
contract InkdInvariantTest is StdInvariant, Test {
    InkdToken public token;
    MockUSDC public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;
    InkdHandler public handler;

    address public deployer = address(this);
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");

    function setUp() public {
        token = new InkdToken();
        usdc = new MockUSDC();

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer, address(usdc), arweaveWallet, buybackWallet))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (deployer, address(usdc), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        treasury.setRegistry(address(registry));
        // Fee = 0 so handler actions don't need USDC
        treasury.setArweaveFee(0);
        treasury.setServiceFee(0);

        handler = new InkdHandler(token, treasury, registry);
        targetContract(address(handler));
    }

    // ─── INVARIANT: $INKD supply never increases ───────────────────────────

    function invariant_totalSupply_neverIncreases() public view {
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ─── INVARIANT: Registry holds no ETH ─────────────────────────────────

    function invariant_registry_holdsNoETH() public view {
        assertEq(address(registry).balance, 0);
    }

    // ─── INVARIANT: projectCount is monotonic ─────────────────────────────

    function invariant_projectCount_matchesGhost() public view {
        assertEq(registry.projectCount(), handler.ghostProjectCount());
    }

    // ─── INVARIANT: serviceFee >= arweaveFee ──────────────────────────────

    function invariant_serviceFee_geq_arweaveFee() public view {
        assertGe(treasury.serviceFee(), treasury.arweaveFee());
    }
}
