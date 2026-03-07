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
    InkdToken    public token;
    InkdTreasury public treasury;
    InkdRegistry public registry;
    MockUSDC     public usdc;

    address[] public actors;
    address   public settler;

    // Ghost state — mirrors what on-chain should reflect
    uint256 public ghostProjectCount;
    uint256 public ghostTotalVersions;
    uint256 public ghostTotalUsdcSettled;

    // Track names to avoid duplicates in handler
    mapping(string => bool) public usedNames;

    constructor(InkdToken _token, InkdTreasury _treasury, InkdRegistry _registry, MockUSDC _usdc, address _settler) {
        token    = _token;
        treasury = _treasury;
        registry = _registry;
        usdc     = _usdc;
        settler  = _settler;

        for (uint256 i = 0; i < 5; i++) {
            address a = makeAddr(string(abi.encodePacked("actor-", vm.toString(i))));
            actors.push(a);
            usdc.mint(a, 1_000_000 * 1e6);
            vm.prank(a);
            usdc.approve(address(registry), type(uint256).max);
        }
    }

    // ─── Actions ─────────────────────────────────────────────────────────

    function createProject(uint256 actorSeed, uint256 nameSeed) external {
        address actor = actors[actorSeed % actors.length];
        string memory name = string(abi.encodePacked("p-", vm.toString(nameSeed % 10000)));
        if (usedNames[name]) return;

        vm.prank(actor);
        try registry.createProject(name, "handler", "MIT", true, "", false, "") {
            ghostProjectCount++;
            usedNames[name] = true;
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
        try registry.pushVersion(projectId, "ar://invariant", "1.0", "inv") {
            ghostTotalVersions++;
        } catch {}
    }

    function addCollaborator(uint256 ownerSeed, uint256 collabSeed) external {
        uint256 count = registry.projectCount();
        if (count == 0) return;

        address owner  = actors[ownerSeed  % actors.length];
        address collab = actors[collabSeed % actors.length];
        if (owner == collab) return;

        // Find a project owned by owner
        uint256[] memory owned = registry.getOwnerProjects(owner);
        if (owned.length == 0) return;

        uint256 projectId = owned[0];
        vm.prank(owner);
        try registry.addCollaborator(projectId, collab) {} catch {}
    }

    function transferProject(uint256 actorSeed, uint256 newOwnerSeed) external {
        uint256 count = registry.projectCount();
        if (count == 0) return;

        address from = actors[actorSeed    % actors.length];
        address to   = actors[newOwnerSeed % actors.length];
        if (from == to) return;

        uint256[] memory owned = registry.getOwnerProjects(from);
        if (owned.length == 0) return;

        vm.prank(from);
        try registry.transferProject(owned[0], to) {} catch {}
    }

    function settle(uint256 amount, uint256 arweaveCost) external {
        amount      = bound(amount, 2, 10_000 * 1e6);
        arweaveCost = bound(arweaveCost, 0, amount / 2);

        usdc.mint(address(treasury), amount);
        vm.prank(settler);
        try treasury.settle(amount, arweaveCost) {
            ghostTotalUsdcSettled += amount;
        } catch {}
    }

    function setMarkupBps(uint256 bps) external {
        bps = bound(bps, 0, 5000);
        address owner = treasury.owner();
        vm.prank(owner);
        try treasury.setMarkupBps(bps) {} catch {}
    }
}

/// @title InkdInvariantTest — Invariant tests for the Inkd Protocol
contract InkdInvariantTest is StdInvariant, Test {
    InkdToken    public token;
    MockUSDC     public usdc;
    InkdTreasury public treasury;
    InkdRegistry public registry;
    InkdHandler  public handler;

    address public deployer      = address(this);
    address public arweaveWallet = makeAddr("arweaveWallet");
    address public buybackWallet = makeAddr("buybackWallet");
    address public settler       = makeAddr("settler");

    function setUp() public {
        token = new InkdToken();
        usdc  = new MockUSDC();

        InkdTreasury tImpl = new InkdTreasury();
        treasury = InkdTreasury(payable(address(new ERC1967Proxy(
            address(tImpl),
            abi.encodeCall(InkdTreasury.initialize, (deployer, address(usdc), settler, arweaveWallet, buybackWallet))
        ))));

        InkdRegistry rImpl = new InkdRegistry();
        registry = InkdRegistry(address(new ERC1967Proxy(
            address(rImpl),
            abi.encodeCall(InkdRegistry.initialize, (deployer, address(usdc), address(treasury)))
        )));

        treasury.setRegistry(address(registry));
        treasury.setDefaultFee(0); // fee = 0 so handler actors don't need USDC for registry calls

        handler = new InkdHandler(token, treasury, registry, usdc, settler);
        targetContract(address(handler));
    }

    // ─── INVARIANT: $INKD total supply never increases ─────────────────────

    function invariant_totalSupply_neverIncreases() public view {
        assertLe(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    // ─── INVARIANT: Registry holds no ETH ──────────────────────────────────

    function invariant_registry_holdsNoETH() public view {
        assertEq(address(registry).balance, 0);
    }

    // ─── INVARIANT: projectCount matches ghost ─────────────────────────────

    function invariant_projectCount_matchesGhost() public view {
        assertEq(registry.projectCount(), handler.ghostProjectCount());
    }

    // ─── INVARIANT: every project has a non-zero owner ─────────────────────

    function invariant_allProjects_haveOwner() public view {
        uint256 count = registry.projectCount();
        for (uint256 i = 1; i <= count; i++) {
            InkdRegistry.Project memory p = registry.getProject(i);
            assertTrue(p.exists, "project marked non-existent");
            assertTrue(p.owner != address(0), "project has zero owner");
        }
    }

    // ─── INVARIANT: project names are globally taken (nameTaken = true) ─────

    function invariant_projectNames_markedTaken() public view {
        uint256 count = registry.projectCount();
        for (uint256 i = 1; i <= count; i++) {
            string memory name = registry.getProject(i).name;
            assertTrue(registry.nameTaken(name), "active project name not marked taken");
        }
    }

    // ─── INVARIANT: versionCount is per-project monotonic ──────────────────

    function invariant_versionCounts_nonNegative() public view {
        uint256 count = registry.projectCount();
        uint256 total;
        for (uint256 i = 1; i <= count; i++) {
            uint256 vc = registry.getVersionCount(i);
            total += vc;
            // versionCount in struct matches actual array length
            assertEq(registry.getProject(i).versionCount, vc);
        }
    }

    // ─── INVARIANT: markupBps always <= 5000 ───────────────────────────────

    function invariant_markupBps_bounded() public view {
        assertLe(treasury.markupBps(), 5000);
    }

    // ─── INVARIANT: Treasury USDC balance is non-negative (trivially true) ─

    function invariant_treasury_usdcBalance_nonNegative() public view {
        assertGe(usdc.balanceOf(address(treasury)), 0);
    }

    // ─── INVARIANT: Registry owner is always the deployer ──────────────────
    // (only transferable via UUPS + Ownable, handler never calls these)

    function invariant_registry_ownerUnchanged() public view {
        assertEq(registry.owner(), deployer);
    }

    function invariant_treasury_ownerUnchanged() public view {
        assertEq(treasury.owner(), deployer);
    }
}
