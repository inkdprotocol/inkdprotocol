// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InkdTimelock} from "../src/InkdTimelock.sol";

// ─────────────────────────────────────────────────────────────────────────────
//  Helper — simple target contract for call execution tests
// ─────────────────────────────────────────────────────────────────────────────

contract MockTarget {
    uint256 public value;
    bool public shouldRevert;

    event Called(uint256 newValue);

    function setValue(uint256 v) external payable {
        if (shouldRevert) revert("MockTarget: forced revert");
        value = v;
        emit Called(v);
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }

    receive() external payable {}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main test suite
// ─────────────────────────────────────────────────────────────────────────────

contract InkdTimelockTest is Test {
    InkdTimelock public timelock;
    MockTarget   public target;

    address public admin   = address(this);
    address public alice   = makeAddr("alice");
    address public bob     = makeAddr("bob");

    // helpers
    uint256 constant DELAY        = 48 hours;
    uint256 constant GRACE_PERIOD = 14 days;

    function setUp() public {
        timelock = new InkdTimelock(admin);
        target   = new MockTarget();
        vm.deal(address(timelock), 10 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Constants & initial state
    // ─────────────────────────────────────────────────────────────────────────

    function test_constants_delay() public view {
        assertEq(timelock.DELAY(), 48 hours);
    }

    function test_constants_gracePeriod() public view {
        assertEq(timelock.GRACE_PERIOD(), 14 days);
    }

    function test_constructor_setsAdmin() public view {
        assertEq(timelock.admin(), admin);
    }

    function test_constructor_pendingAdminIsZero() public view {
        assertEq(timelock.pendingAdmin(), address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  receive()
    // ─────────────────────────────────────────────────────────────────────────

    function test_receive_acceptsEth() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(timelock).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertGe(address(timelock).balance, 0.5 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  setPendingAdmin
    // ─────────────────────────────────────────────────────────────────────────

    function test_setPendingAdmin_success() public {
        timelock.setPendingAdmin(alice);
        assertEq(timelock.pendingAdmin(), alice);
    }

    function test_setPendingAdmin_emitsEvent() public {
        vm.expectEmit(true, false, false, false);
        emit InkdTimelock.NewPendingAdmin(alice);
        timelock.setPendingAdmin(alice);
    }

    function test_setPendingAdmin_reverts_nonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("InkdTimelock: caller is not admin");
        timelock.setPendingAdmin(alice);
    }

    function test_setPendingAdmin_canSetZero() public {
        timelock.setPendingAdmin(alice);
        timelock.setPendingAdmin(address(0));
        assertEq(timelock.pendingAdmin(), address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  acceptAdmin
    // ─────────────────────────────────────────────────────────────────────────

    function test_acceptAdmin_success() public {
        timelock.setPendingAdmin(alice);
        vm.prank(alice);
        timelock.acceptAdmin();
        assertEq(timelock.admin(), alice);
        assertEq(timelock.pendingAdmin(), address(0));
    }

    function test_acceptAdmin_emitsEvent() public {
        timelock.setPendingAdmin(alice);
        vm.expectEmit(true, false, false, false);
        emit InkdTimelock.NewAdmin(alice);
        vm.prank(alice);
        timelock.acceptAdmin();
    }

    function test_acceptAdmin_clearsPendingAdmin() public {
        timelock.setPendingAdmin(alice);
        vm.prank(alice);
        timelock.acceptAdmin();
        assertEq(timelock.pendingAdmin(), address(0));
    }

    function test_acceptAdmin_reverts_notPendingAdmin() public {
        timelock.setPendingAdmin(alice);
        vm.prank(bob);
        vm.expectRevert("InkdTimelock: not pending admin");
        timelock.acceptAdmin();
    }

    function test_acceptAdmin_reverts_zeroPendingAdmin() public {
        // pendingAdmin is address(0) by default; calling from non-zero reverts
        vm.prank(alice);
        vm.expectRevert("InkdTimelock: not pending admin");
        timelock.acceptAdmin();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  queueTransaction
    // ─────────────────────────────────────────────────────────────────────────

    function _validEta() internal view returns (uint256) {
        return block.timestamp + DELAY + 1;
    }

    function _callData(uint256 v) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(MockTarget.setValue.selector, v);
    }

    function test_queueTransaction_success() public {
        uint256 eta = _validEta();
        bytes32 txHash = timelock.queueTransaction(address(target), 0, _callData(42), eta);
        assertTrue(timelock.queuedTransactions(txHash));
    }

    function test_queueTransaction_returnsCorrectHash() public {
        uint256 eta = _validEta();
        bytes memory data = _callData(99);
        bytes32 expected = keccak256(abi.encode(address(target), uint256(0), data, eta));
        bytes32 actual   = timelock.queueTransaction(address(target), 0, data, eta);
        assertEq(actual, expected);
    }

    function test_queueTransaction_emitsEvent() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(7);
        bytes32 txHash = keccak256(abi.encode(address(target), uint256(0), data, eta));
        vm.expectEmit(true, true, false, true);
        emit InkdTimelock.QueueTransaction(txHash, address(target), 0, data, eta);
        timelock.queueTransaction(address(target), 0, data, eta);
    }

    function test_queueTransaction_reverts_nonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("InkdTimelock: caller is not admin");
        timelock.queueTransaction(address(target), 0, _callData(1), _validEta());
    }

    function test_queueTransaction_reverts_etaTooEarly() public {
        uint256 badEta = block.timestamp + DELAY - 1; // one second too early
        vm.expectRevert("InkdTimelock: eta too early");
        timelock.queueTransaction(address(target), 0, _callData(1), badEta);
    }

    function test_queueTransaction_reverts_etaExactlyNow() public {
        // eta == block.timestamp is way too early
        vm.expectRevert("InkdTimelock: eta too early");
        timelock.queueTransaction(address(target), 0, _callData(1), block.timestamp);
    }

    function test_queueTransaction_acceptsEtaExactlyAtDelay() public {
        uint256 eta = block.timestamp + DELAY; // exactly at boundary
        bytes32 txHash = timelock.queueTransaction(address(target), 0, _callData(5), eta);
        assertTrue(timelock.queuedTransactions(txHash));
    }

    function test_queueTransaction_multipleDistinctHashes() public {
        uint256 eta = _validEta();
        bytes32 h1 = timelock.queueTransaction(address(target), 0, _callData(1), eta);
        bytes32 h2 = timelock.queueTransaction(address(target), 0, _callData(2), eta);
        assertTrue(h1 != h2);
        assertTrue(timelock.queuedTransactions(h1));
        assertTrue(timelock.queuedTransactions(h2));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  cancelTransaction
    // ─────────────────────────────────────────────────────────────────────────

    function test_cancelTransaction_success() public {
        uint256 eta = _validEta();
        bytes memory data = _callData(10);
        bytes32 txHash = timelock.queueTransaction(address(target), 0, data, eta);
        assertTrue(timelock.queuedTransactions(txHash));

        timelock.cancelTransaction(address(target), 0, data, eta);
        assertFalse(timelock.queuedTransactions(txHash));
    }

    function test_cancelTransaction_emitsEvent() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(10);
        bytes32 txHash = keccak256(abi.encode(address(target), uint256(0), data, eta));
        timelock.queueTransaction(address(target), 0, data, eta);

        vm.expectEmit(true, true, false, true);
        emit InkdTimelock.CancelTransaction(txHash, address(target), 0, data, eta);
        timelock.cancelTransaction(address(target), 0, data, eta);
    }

    function test_cancelTransaction_reverts_nonAdmin() public {
        uint256 eta = _validEta();
        bytes memory data = _callData(10);
        timelock.queueTransaction(address(target), 0, data, eta);

        vm.prank(alice);
        vm.expectRevert("InkdTimelock: caller is not admin");
        timelock.cancelTransaction(address(target), 0, data, eta);
    }

    function test_cancelTransaction_idempotent() public {
        // cancelling a non-queued tx just sets false → false; no revert
        uint256 eta = _validEta();
        bytes memory data = _callData(99);
        timelock.cancelTransaction(address(target), 0, data, eta);
        bytes32 txHash = keccak256(abi.encode(address(target), uint256(0), data, eta));
        assertFalse(timelock.queuedTransactions(txHash));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  executeTransaction
    // ─────────────────────────────────────────────────────────────────────────

    function _queueAndWarp(uint256 v) internal returns (bytes32 txHash, uint256 eta, bytes memory data) {
        eta  = _validEta();
        data = _callData(v);
        txHash = timelock.queueTransaction(address(target), 0, data, eta);
        vm.warp(eta); // jump to exactly eta
    }

    function test_executeTransaction_success() public {
        (bytes32 txHash, uint256 eta, bytes memory data) = _queueAndWarp(123);
        timelock.executeTransaction(address(target), 0, data, eta);
        assertEq(target.value(), 123);
        assertFalse(timelock.queuedTransactions(txHash));
    }

    function test_executeTransaction_emitsEvent() public {
        (bytes32 txHash, uint256 eta, bytes memory data) = _queueAndWarp(55);
        vm.expectEmit(true, true, false, true);
        emit InkdTimelock.ExecuteTransaction(txHash, address(target), 0, data, eta);
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_returnsData() public {
        // setValue has no return value, so returnData should be empty
        (, uint256 eta, bytes memory data) = _queueAndWarp(1);
        bytes memory ret = timelock.executeTransaction(address(target), 0, data, eta);
        assertEq(ret.length, 0);
    }

    function test_executeTransaction_reverts_notQueued() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(9);
        vm.warp(eta);
        vm.expectRevert("InkdTimelock: tx not queued");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_reverts_tooEarly() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(9);
        timelock.queueTransaction(address(target), 0, data, eta);
        vm.warp(eta - 1); // one second before eta
        vm.expectRevert("InkdTimelock: too early");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_reverts_stale() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(9);
        timelock.queueTransaction(address(target), 0, data, eta);
        vm.warp(eta + GRACE_PERIOD + 1); // past grace period
        vm.expectRevert("InkdTimelock: tx stale");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_reverts_nonAdmin() public {
        (, uint256 eta, bytes memory data) = _queueAndWarp(5);
        vm.prank(alice);
        vm.expectRevert("InkdTimelock: caller is not admin");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_reverts_targetReverts() public {
        target.setShouldRevert(true);
        (, uint256 eta, bytes memory data) = _queueAndWarp(77);
        vm.expectRevert("InkdTimelock: execution failed");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_consumesTxHash() public {
        (bytes32 txHash, uint256 eta, bytes memory data) = _queueAndWarp(3);
        timelock.executeTransaction(address(target), 0, data, eta);
        assertFalse(timelock.queuedTransactions(txHash));
    }

    function test_executeTransaction_cannotReplay() public {
        (, uint256 eta, bytes memory data) = _queueAndWarp(3);
        timelock.executeTransaction(address(target), 0, data, eta);
        // hash is now false → should revert on replay
        vm.expectRevert("InkdTimelock: tx not queued");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_executeTransaction_withValue() public {
        uint256 eta  = _validEta();
        bytes memory data = ""; // just send ETH
        timelock.queueTransaction(address(target), 1 ether, data, eta);
        vm.warp(eta);
        uint256 before = address(target).balance;
        timelock.executeTransaction{value: 1 ether}(address(target), 1 ether, data, eta);
        assertEq(address(target).balance, before + 1 ether);
    }

    function test_executeTransaction_exactlyAtGracePeriodBoundary() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(8);
        timelock.queueTransaction(address(target), 0, data, eta);
        vm.warp(eta + GRACE_PERIOD); // exactly at last valid second
        timelock.executeTransaction(address(target), 0, data, eta);
        assertEq(target.value(), 8);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Full integration flows
    // ─────────────────────────────────────────────────────────────────────────

    function test_flow_queueCancelCannotExecute() public {
        uint256 eta  = _validEta();
        bytes memory data = _callData(42);
        timelock.queueTransaction(address(target), 0, data, eta);
        timelock.cancelTransaction(address(target), 0, data, eta);
        vm.warp(eta);
        vm.expectRevert("InkdTimelock: tx not queued");
        timelock.executeTransaction(address(target), 0, data, eta);
    }

    function test_flow_adminHandover() public {
        // admin queues a handover via acceptAdmin flow (no timelock needed for this)
        timelock.setPendingAdmin(alice);
        assertEq(timelock.pendingAdmin(), alice);
        vm.prank(alice);
        timelock.acceptAdmin();
        assertEq(timelock.admin(), alice);

        // old admin can no longer queue
        vm.expectRevert("InkdTimelock: caller is not admin");
        timelock.queueTransaction(address(target), 0, _callData(1), _validEta());

        // new admin can queue
        vm.prank(alice);
        bytes32 h = timelock.queueTransaction(address(target), 0, _callData(1), _validEta());
        assertTrue(timelock.queuedTransactions(h));
    }

    function test_flow_multipleTransactions() public {
        uint256 eta1 = _validEta();
        uint256 eta2 = eta1 + 1 hours;
        bytes memory d1 = _callData(10);
        bytes memory d2 = _callData(20);

        timelock.queueTransaction(address(target), 0, d1, eta1);
        timelock.queueTransaction(address(target), 0, d2, eta2);

        // execute first
        vm.warp(eta1);
        timelock.executeTransaction(address(target), 0, d1, eta1);
        assertEq(target.value(), 10);

        // execute second
        vm.warp(eta2);
        timelock.executeTransaction(address(target), 0, d2, eta2);
        assertEq(target.value(), 20);
    }
}
