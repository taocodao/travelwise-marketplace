// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentEscrow
 * @dev Holds USDC payments for x402 transactions
 */
contract PaymentEscrow is ReentrancyGuard, Ownable {
    IERC20 public usdc;

    struct Payment {
        address payer;
        address payee;
        uint256 amount;
        uint256 createdAt;
        bool released;
        bool refunded;
    }

    mapping(bytes32 => Payment) public payments;

    event PaymentCreated(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed payee,
        uint256 amount
    );

    event PaymentReleased(
        bytes32 indexed paymentId,
        address indexed payee,
        uint256 amount
    );

    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed payer,
        uint256 amount
    );

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    /**
     * @dev Create an escrow payment
     * @param paymentId Unique payment identifier (x402 tx hash)
     * @param payee Address to receive payment
     * @param amount Amount in USDC (6 decimals)
     */
    function createPayment(
        bytes32 paymentId,
        address payee,
        uint256 amount
    ) external nonReentrant {
        require(payments[paymentId].payer == address(0), "Payment exists");
        require(payee != address(0), "Invalid payee");
        require(amount > 0, "Amount must be positive");

        // Transfer USDC from payer to escrow
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        payments[paymentId] = Payment({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            createdAt: block.timestamp,
            released: false,
            refunded: false
        });

        emit PaymentCreated(paymentId, msg.sender, payee, amount);
    }

    /**
     * @dev Release payment to payee (after service completion)
     */
    function releasePayment(bytes32 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        
        require(payment.payer != address(0), "Payment does not exist");
        require(!payment.released, "Already released");
        require(!payment.refunded, "Already refunded");
        require(
            msg.sender == payment.payer || msg.sender == owner(),
            "Not authorized"
        );

        payment.released = true;

        require(
            usdc.transfer(payment.payee, payment.amount),
            "USDC transfer failed"
        );

        emit PaymentReleased(paymentId, payment.payee, payment.amount);
    }

    /**
     * @dev Refund payment to payer (if service fails)
     */
    function refundPayment(bytes32 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        
        require(payment.payer != address(0), "Payment does not exist");
        require(!payment.released, "Already released");
        require(!payment.refunded, "Already refunded");
        require(
            msg.sender == payment.payee || msg.sender == owner(),
            "Not authorized"
        );

        payment.refunded = true;

        require(
            usdc.transfer(payment.payer, payment.amount),
            "USDC transfer failed"
        );

        emit PaymentRefunded(paymentId, payment.payer, payment.amount);
    }

    /**
     * @dev Get payment details
     */
    function getPayment(bytes32 paymentId)
        external
        view
        returns (Payment memory)
    {
        return payments[paymentId];
    }
}
