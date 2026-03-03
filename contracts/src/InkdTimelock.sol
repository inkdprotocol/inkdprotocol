// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  InkdTimelock
 * @notice 48-hour timelock for inkd protocol admin actions.
 *         Queued transactions must wait DELAY seconds before execution.
 *         Inspired by Compound's Timelock — simplified for inkd's needs.
 *
 *         Ownership of InkdRegistry and InkdTreasury should be transferred
 *         to this contract (or a Safe multisig) after deploy.
 */

contract InkdTimelock {
    uint256 public constant DELAY     = 48 hours;
    uint256 public constant GRACE_PERIOD = 14 days;

    address public admin;
    address public pendingAdmin;

    mapping(bytes32 => bool) public queuedTransactions;

    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewAdmin(address indexed newAdmin);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, bytes data, uint256 eta);

    modifier onlyAdmin() {
        require(msg.sender == admin, "InkdTimelock: caller is not admin");
        _;
    }

    constructor(address admin_) {
        admin = admin_;
    }

    receive() external payable {}

    function setPendingAdmin(address pendingAdmin_) external onlyAdmin {
        pendingAdmin = pendingAdmin_;
        emit NewPendingAdmin(pendingAdmin_);
    }

    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "InkdTimelock: not pending admin");
        admin = pendingAdmin;
        pendingAdmin = address(0);
        emit NewAdmin(admin);
    }

    function queueTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin returns (bytes32) {
        require(eta >= block.timestamp + DELAY, "InkdTimelock: eta too early");

        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, data, eta);
        return txHash;
    }

    function cancelTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        queuedTransactions[txHash] = false;
        emit CancelTransaction(txHash, target, value, data, eta);
    }

    function executeTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 eta
    ) external payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, data, eta));
        require(queuedTransactions[txHash], "InkdTimelock: tx not queued");
        require(block.timestamp >= eta, "InkdTimelock: too early");
        require(block.timestamp <= eta + GRACE_PERIOD, "InkdTimelock: tx stale");

        queuedTransactions[txHash] = false;

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "InkdTimelock: execution failed");

        emit ExecuteTransaction(txHash, target, value, data, eta);
        return returnData;
    }
}
