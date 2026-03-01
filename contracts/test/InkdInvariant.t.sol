// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {InkdToken} from "../src/InkdToken.sol";
import {InkdTreasury} from "../src/InkdTreasury.sol";
import {InkdRegistry} from "../src/InkdRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title InkdHandler — Actor handler for invariant tests
/// @notice Exposes bounded actions for the fuzzer to call.
contract InkdHandler is Test {
    InkdToken public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;

    address[] public actors;
    uint256 public ghostProjectCount;
    uint256 public ghostTokenLocked;

    constructor(InkdToken _token, InkdTreasury _treasury, InkdRegistry _registry) {
        token = _token;
        treasury = _treasury;
        registry = _registry;

        // Pre-fund 3 actors
        for (uint256 i = 0; i < 3; i++) {
            address a = makeAddr(string(abi.encodePacked("actor-", vm.toString(i))));
            actors.push(a);
            token.transfer(a, 10_000 ether);
            vm.deal(a, 100 ether);
        }
    }

    function createProject(uint256 actorSeed, uint256 nameSeed) external {
        address actor = actors[actorSeed % actors.length];
        string memory name = string(abi.encodePacked("proj-", vm.toString(nameSeed)));

        if (registry.nameTaken(name)) return;

        vm.startPrank(actor);
        if (token.allowance(actor, address(registry)) < 1 ether) {
            token.approve(address(registry), type(uint256).max);
        }
        if (token.balanceOf(actor) < 1 ether) {
            vm.stopPrank();
            return;
        }
        try registry.createProject(name, "handler", "MIT", true, "", false, "") {
            ghostProjectCount++;
            ghostTokenLocked += 1 ether;
        } catch {}
        vm.stopPrank();
    }

    function pushVersion(uint256 actorSeed, uint256 projectIdSeed) external {
        uint256 count = registry.projectCount();
        if (count == 0) return;

        address actor = actors[actorSeed % actors.length];
        uint256 projectId = (projectIdSeed % count) + 1;

        InkdRegistry.Project memory p = registry.getProject(projectId);
        if (p.owner != actor && !registry.isCollaborator(projectId, actor)) return;

        uint256 fee = registry.versionFee();
        if (actor.balance < fee) return;

        vm.prank(actor);
        try registry.pushVersion{value: fee}(projectId, "ar://fuzz", "1.0", "inv") {} catch {}
    }
}

/// @title InkdInvariantTest — Invariant tests for the Inkd Protocol
/// @notice Properties that must hold across ALL sequences of actions.
contract InkdInvariantTest is StdInvariant, Test {
    InkdToken public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;
    InkdHandler public handler;

    address public deployer = address(this);

    function setUp() public {
        token = new InkdToken();

        InkdTreasury treasuryImpl = new InkdTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer))
        );
        treasury = InkdTreasury(payable(address(treasuryProxy)));

        InkdRegistry registryImpl = new InkdRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl),
            abi.encodeCall(InkdRegistry.initialize, (deployer, address(token), address(treasury)))
        );
        registry = InkdRegistry(address(registryProxy));

        treasury.setRegistry(address(registry));

        handler = new InkdHandler(token, treasury, registry);
        targetContract(address(handler));
    }

    // ─── INVARIANT: $INKD supply never increases ───────────────────────────

    /// @notice Total supply can only decrease (burns) or stay constant. Never increases.
    function invariant_totalSupply_neverIncreases() public view {
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ─── INVARIANT: Registry ETH balance is always zero ───────────────────

    /// @notice The registry must never hold ETH — all fees forwarded to treasury.
    function invariant_registry_holdsNoETH() public view {
        assertEq(address(registry).balance, 0);
    }

    // ─── INVARIANT: Token locked = projectCount × TOKEN_LOCK_AMOUNT ────────

    /// @notice Locked $INKD in registry == projectCount × 1 ether at all times.
    function invariant_tokenLocked_matchesProjectCount() public view {
        assertEq(
            token.balanceOf(address(registry)),
            registry.projectCount() * registry.TOKEN_LOCK_AMOUNT()
        );
    }

    // ─── INVARIANT: projectCount only increases ────────────────────────────

    /// @notice projectCount must equal handler's ghost counter.
    function invariant_projectCount_matchesGhost() public view {
        assertEq(registry.projectCount(), handler.ghostProjectCount());
    }

    // ─── INVARIANT: versionFee always within bounds ────────────────────────

    /// @notice versionFee must never exceed MAX_VERSION_FEE.
    function invariant_versionFee_withinBounds() public view {
        assertLe(registry.versionFee(), registry.MAX_VERSION_FEE());
    }

    // ─── INVARIANT: transferFee always within bounds ───────────────────────

    /// @notice transferFee must never exceed MAX_TRANSFER_FEE.
    function invariant_transferFee_withinBounds() public view {
        assertLe(registry.transferFee(), registry.MAX_TRANSFER_FEE());
    }
}
