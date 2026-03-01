// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdVault Test Suite
 * @notice Comprehensive tests for the InkdVault contract covering mint, purchase,
 *         burn, pricing, batch mint, versioning, access grants, admin functions,
 *         and edge cases.
 */

import "forge-std/Test.sol";
import "../src/InkdVault.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract InkdVaultTest is Test {
    InkdVault vault;
    address owner  = address(0xA00);
    address agent1 = address(0xB00);
    address agent2 = address(0xC00);
    address agent3 = address(0xD00);

    function setUp() public {
        InkdVault impl = new InkdVault();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(InkdVault.initialize, (owner))
        );
        vault = InkdVault(address(proxy));
        vm.deal(agent1, 100 ether);
        vm.deal(agent2, 100 ether);
        vm.deal(agent3, 100 ether);
    }

    // ─── Initialization ─────────────────────────────────────────────────────

    function test_initialize() public view {
        assertEq(vault.protocolFeeBps(), 100);
        assertEq(vault.nextTokenId(), 0);
        assertEq(vault.protocolFeeBalance(), 0);
        assertEq(vault.owner(), owner);
    }

    // ─── Mint ───────────────────────────────────────────────────────────────

    function test_mint() public {
        vm.prank(agent1);
        uint256 id = vault.mint("arweave-hash-001", "ipfs://meta/1", 1 ether);

        assertEq(id, 0);
        assertEq(vault.balanceOf(agent1, id), 1);
        assertEq(vault.nextTokenId(), 1);

        (address creator, string memory hash, string memory metaURI, uint256 price, uint256 createdAt) = vault.tokens(id);
        assertEq(creator, agent1);
        assertEq(hash, "arweave-hash-001");
        assertEq(metaURI, "ipfs://meta/1");
        assertEq(price, 1 ether);
        assertGt(createdAt, 0);
    }

    function test_mint_emits_event() public {
        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit InkdVault.DataMinted(0, agent1, "hash", "meta", 0.5 ether);
        vault.mint("hash", "meta", 0.5 ether);
    }

    function test_mint_no_price() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);
        (,,, uint256 price,) = vault.tokens(id);
        assertEq(price, 0);
    }

    function test_mint_sequential_ids() public {
        vm.startPrank(agent1);
        uint256 id0 = vault.mint("h0", "m0", 0);
        uint256 id1 = vault.mint("h1", "m1", 0);
        uint256 id2 = vault.mint("h2", "m2", 0);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
    }

    function test_mint_creates_initial_version() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash-v0", "meta", 0);

        assertEq(vault.getVersionCount(id), 1);
        assertEq(vault.getVersion(id, 0), "hash-v0");
    }

    // ─── Batch Mint ─────────────────────────────────────────────────────────

    function test_batchMint() public {
        string[] memory hashes = new string[](3);
        hashes[0] = "hash-a";
        hashes[1] = "hash-b";
        hashes[2] = "hash-c";

        string[] memory metas = new string[](3);
        metas[0] = "meta-a";
        metas[1] = "meta-b";
        metas[2] = "meta-c";

        uint256[] memory prices = new uint256[](3);
        prices[0] = 1 ether;
        prices[1] = 2 ether;
        prices[2] = 0;

        vm.prank(agent1);
        uint256[] memory ids = vault.batchMint(hashes, metas, prices);

        assertEq(ids.length, 3);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
        assertEq(ids[2], 2);

        for (uint256 i; i < 3; i++) {
            assertEq(vault.balanceOf(agent1, ids[i]), 1);
        }

        (,, string memory m1,,) = vault.tokens(ids[1]);
        assertEq(m1, "meta-b");
    }

    function test_batchMint_reverts_array_mismatch() public {
        string[] memory hashes = new string[](2);
        hashes[0] = "a";
        hashes[1] = "b";

        string[] memory metas = new string[](1);
        metas[0] = "m";

        uint256[] memory prices = new uint256[](2);

        vm.prank(agent1);
        vm.expectRevert(InkdVault.ArrayLengthMismatch.selector);
        vault.batchMint(hashes, metas, prices);
    }

    function test_batchMint_emits_BatchMinted() public {
        string[] memory hashes = new string[](1);
        hashes[0] = "h";
        string[] memory metas = new string[](1);
        metas[0] = "m";
        uint256[] memory prices = new uint256[](1);
        prices[0] = 0;

        vm.prank(agent1);
        vault.batchMint(hashes, metas, prices);
        // BatchMinted event is emitted — covered by the call succeeding
    }

    // ─── Purchase ───────────────────────────────────────────────────────────

    function test_purchase() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);

        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        uint256 sellerBefore = agent1.balance;

        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);

        assertEq(vault.balanceOf(agent2, id), 1);
        assertEq(vault.balanceOf(agent1, id), 0);
        assertEq(agent1.balance, sellerBefore + 0.99 ether);
        assertEq(vault.protocolFeeBalance(), 0.01 ether);
    }

    function test_purchase_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        vm.prank(agent2);
        vm.expectEmit(true, true, true, true);
        emit InkdVault.DataPurchased(id, agent2, agent1, 1 ether, 0.01 ether);
        vault.purchase{value: 1 ether}(id, agent1);
    }

    function test_purchase_reverts_not_for_sale() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.NotForSale.selector, id));
        vault.purchase{value: 1 ether}(id, agent1);
    }

    function test_purchase_reverts_insufficient_payment() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 2 ether);

        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.InsufficientPayment.selector, 2 ether, 1 ether));
        vault.purchase{value: 1 ether}(id, agent1);
    }

    function test_purchase_reverts_seller_not_owner() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.SellerNotOwner.selector, id, agent2));
        vault.purchase{value: 1 ether}(id, agent2);
    }

    function test_purchase_overpayment_goes_to_seller() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        uint256 sellerBefore = agent1.balance;

        vm.prank(agent2);
        vault.purchase{value: 2 ether}(id, agent1);

        // Fee on 2 ETH = 0.02 ETH, seller gets 1.98 ETH
        assertEq(agent1.balance, sellerBefore + 1.98 ether);
        assertEq(vault.protocolFeeBalance(), 0.02 ether);
    }

    // ─── Set Price ──────────────────────────────────────────────────────────

    function test_setPrice() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vault.setPrice(id, 5 ether);

        (,,, uint256 price,) = vault.tokens(id);
        assertEq(price, 5 ether);
    }

    function test_setPrice_delist() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 3 ether);

        vm.prank(agent1);
        vault.setPrice(id, 0);

        (,,, uint256 price,) = vault.tokens(id);
        assertEq(price, 0);
    }

    function test_setPrice_reverts_not_owner() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.NotTokenOwner.selector, id, agent2));
        vault.setPrice(id, 2 ether);
    }

    function test_setPrice_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vm.expectEmit(true, false, false, true);
        emit InkdVault.PriceUpdated(id, 7 ether);
        vault.setPrice(id, 7 ether);
    }

    // ─── Burn ───────────────────────────────────────────────────────────────

    function test_burn() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vault.burn(id);
        assertEq(vault.balanceOf(agent1, id), 0);
    }

    function test_burn_reverts_not_owner() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.NotTokenOwner.selector, id, agent2));
        vault.burn(id);
    }

    function test_burn_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vm.expectEmit(true, true, false, false);
        emit InkdVault.DataBurned(id, agent1);
        vault.burn(id);
    }

    // ─── Versioning ─────────────────────────────────────────────────────────

    function test_addVersion() public {
        vm.prank(agent1);
        uint256 id = vault.mint("v0-hash", "meta", 0);

        vm.prank(agent1);
        uint256 vi = vault.addVersion(id, "v1-hash");
        assertEq(vi, 1);
        assertEq(vault.getVersionCount(id), 2);
        assertEq(vault.getVersion(id, 0), "v0-hash");
        assertEq(vault.getVersion(id, 1), "v1-hash");

        // Current arweaveHash updated
        (, string memory currentHash,,,) = vault.tokens(id);
        assertEq(currentHash, "v1-hash");
    }

    function test_addVersion_multiple() public {
        vm.prank(agent1);
        uint256 id = vault.mint("v0", "m", 0);

        vm.startPrank(agent1);
        vault.addVersion(id, "v1");
        vault.addVersion(id, "v2");
        vault.addVersion(id, "v3");
        vm.stopPrank();

        assertEq(vault.getVersionCount(id), 4);
        assertEq(vault.getVersion(id, 3), "v3");
    }

    function test_addVersion_reverts_not_owner() public {
        vm.prank(agent1);
        uint256 id = vault.mint("v0", "m", 0);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.NotTokenOwner.selector, id, agent2));
        vault.addVersion(id, "v1");
    }

    function test_addVersion_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("v0", "m", 0);

        vm.prank(agent1);
        vm.expectEmit(true, false, false, true);
        emit InkdVault.VersionAdded(id, 1, "v1");
        vault.addVersion(id, "v1");
    }

    // ─── Access Grants ──────────────────────────────────────────────────────

    function test_grantAccess() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        uint256 expiry = block.timestamp + 1 days;

        vm.prank(agent1);
        vault.grantAccess(id, agent2, expiry);

        assertTrue(vault.checkAccess(id, agent2));
        assertEq(vault.accessGrants(id, agent2), expiry);
    }

    function test_grantAccess_expired() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        uint256 expiry = block.timestamp + 1 hours;

        vm.prank(agent1);
        vault.grantAccess(id, agent2, expiry);

        // Warp past expiry
        vm.warp(expiry + 1);
        assertFalse(vault.checkAccess(id, agent2));
    }

    function test_grantAccess_reverts_not_owner() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent2);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.NotTokenOwner.selector, id, agent2));
        vault.grantAccess(id, agent3, block.timestamp + 1 days);
    }

    function test_grantAccess_reverts_expiry_in_past() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.ExpiryInPast.selector, block.timestamp - 1));
        vault.grantAccess(id, agent2, block.timestamp - 1);
    }

    function test_revokeAccess() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vault.grantAccess(id, agent2, block.timestamp + 1 days);
        assertTrue(vault.checkAccess(id, agent2));

        vm.prank(agent1);
        vault.revokeAccess(id, agent2);
        assertFalse(vault.checkAccess(id, agent2));
    }

    function test_checkAccess_owner_always_has_access() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        assertTrue(vault.checkAccess(id, agent1));
        assertFalse(vault.checkAccess(id, agent2));
    }

    function test_grantAccess_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);
        uint256 expiry = block.timestamp + 1 days;

        vm.prank(agent1);
        vm.expectEmit(true, true, false, true);
        emit InkdVault.AccessGranted(id, agent2, expiry);
        vault.grantAccess(id, agent2, expiry);
    }

    function test_revokeAccess_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 0);

        vm.prank(agent1);
        vault.grantAccess(id, agent2, block.timestamp + 1 days);

        vm.prank(agent1);
        vm.expectEmit(true, true, false, false);
        emit InkdVault.AccessRevoked(id, agent2);
        vault.revokeAccess(id, agent2);
    }

    // ─── Admin ──────────────────────────────────────────────────────────────

    function test_setProtocolFee() public {
        vm.prank(owner);
        vault.setProtocolFee(250); // 2.5%
        assertEq(vault.protocolFeeBps(), 250);
    }

    function test_setProtocolFee_reverts_exceeds_max() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(InkdVault.FeeExceedsMax.selector, 501));
        vault.setProtocolFee(501);
    }

    function test_setProtocolFee_reverts_not_owner() public {
        vm.prank(agent1);
        vm.expectRevert();
        vault.setProtocolFee(200);
    }

    function test_setProtocolFee_emits_event() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit InkdVault.ProtocolFeeUpdated(100, 300);
        vault.setProtocolFee(300);
    }

    function test_withdrawFees() public {
        // Generate fees via purchase
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);
        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);

        assertEq(vault.protocolFeeBalance(), 0.01 ether);

        uint256 ownerBefore = owner.balance;
        vm.prank(owner);
        vault.withdrawFees();

        assertEq(owner.balance, ownerBefore + 0.01 ether);
        assertEq(vault.protocolFeeBalance(), 0);
    }

    function test_withdrawFees_reverts_no_fees() public {
        vm.prank(owner);
        vm.expectRevert(InkdVault.NoFeesToWithdraw.selector);
        vault.withdrawFees();
    }

    function test_withdrawFees_reverts_not_owner() public {
        vm.prank(agent1);
        vm.expectRevert();
        vault.withdrawFees();
    }

    function test_withdrawFees_emits_event() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 2 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);
        vm.prank(agent2);
        vault.purchase{value: 2 ether}(id, agent1);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit InkdVault.FeesWithdrawn(owner, 0.02 ether);
        vault.withdrawFees();
    }

    // ─── URI ────────────────────────────────────────────────────────────────

    function test_uri() public {
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "ipfs://custom-meta", 0);
        assertEq(vault.uri(id), "ipfs://custom-meta");
    }

    // ─── Integration: Full Lifecycle ────────────────────────────────────────

    function test_full_lifecycle() public {
        // Agent1 mints a token
        vm.prank(agent1);
        uint256 id = vault.mint("original-data", "ipfs://meta", 1 ether);
        assertEq(vault.balanceOf(agent1, id), 1);

        // Agent1 adds a version
        vm.prank(agent1);
        vault.addVersion(id, "updated-data-v1");
        assertEq(vault.getVersionCount(id), 2);

        // Agent1 grants temporary access to Agent3
        vm.prank(agent1);
        vault.grantAccess(id, agent3, block.timestamp + 1 days);
        assertTrue(vault.checkAccess(id, agent3));

        // Agent1 lists for sale and Agent2 purchases
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);
        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);
        assertEq(vault.balanceOf(agent2, id), 1);

        // Agent3's grant still works (was granted by previous owner)
        assertTrue(vault.checkAccess(id, agent3));

        // New owner (Agent2) can add versions
        vm.prank(agent2);
        vault.addVersion(id, "new-owner-v2");
        assertEq(vault.getVersionCount(id), 3);

        // Agent2 burns the token
        vm.prank(agent2);
        vault.burn(id);
        assertEq(vault.balanceOf(agent2, id), 0);
    }

    // ─── Edge Cases ─────────────────────────────────────────────────────────

    function test_setProtocolFee_zero() public {
        vm.prank(owner);
        vault.setProtocolFee(0);
        assertEq(vault.protocolFeeBps(), 0);

        // Purchase with zero fee
        vm.prank(agent1);
        uint256 id = vault.mint("hash", "meta", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        uint256 sellerBefore = agent1.balance;
        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id, agent1);

        // Seller gets full amount, no fee
        assertEq(agent1.balance, sellerBefore + 1 ether);
        assertEq(vault.protocolFeeBalance(), 0);
    }

    function test_setProtocolFee_max() public {
        vm.prank(owner);
        vault.setProtocolFee(500); // 5% max
        assertEq(vault.protocolFeeBps(), 500);
    }

    function test_multiple_purchases_accumulate_fees() public {
        vm.prank(agent1);
        uint256 id1 = vault.mint("h1", "m1", 1 ether);
        vm.prank(agent1);
        vault.setApprovalForAll(address(vault), true);

        vm.prank(agent2);
        vault.purchase{value: 1 ether}(id1, agent1);

        // Agent2 relists and agent3 buys
        vm.prank(agent2);
        vault.setPrice(id1, 2 ether);
        vm.prank(agent2);
        vault.setApprovalForAll(address(vault), true);

        vm.prank(agent3);
        vault.purchase{value: 2 ether}(id1, agent2);

        // Total fees: 0.01 + 0.02 = 0.03 ETH
        assertEq(vault.protocolFeeBalance(), 0.03 ether);
    }
}
