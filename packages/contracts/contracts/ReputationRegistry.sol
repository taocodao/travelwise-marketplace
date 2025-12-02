// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationRegistry
 * @dev Stores feedback and reputation scores for agents
 */
contract ReputationRegistry is Ownable {
    struct Feedback {
        address reviewer;
        uint8 score; // 0-100
        string feedbackURI; // IPFS URI with details
        bytes32 proofOfPayment; // x402 transaction hash
        uint256 timestamp;
        bool revoked;
    }

    struct ReputationSummary {
        uint256 totalFeedback;
        uint256 averageScore;
        uint256 lastUpdated;
    }

    // agentId => feedback array
    mapping(uint256 => Feedback[]) public agentFeedback;
    
    // agentId => reputation summary
    mapping(uint256 => ReputationSummary) public reputations;

    // Track if reviewer already provided feedback
    mapping(uint256 => mapping(address => bool)) public hasReviewed;

    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 score,
        string feedbackURI,
        bytes32 proofOfPayment
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed reviewer,
        uint256 feedbackIndex
    );

    /**
     * @dev Submit feedback for an agent
     * @param agentId The agent ID
     * @param score Score 0-100
     * @param feedbackURI IPFS URI with detailed feedback
     * @param proofOfPayment x402 transaction hash proving payment occurred
     */
    function submitFeedback(
        uint256 agentId,
        uint8 score,
        string memory feedbackURI,
        bytes32 proofOfPayment
    ) external {
        require(score <= 100, "Score must be 0-100");
        require(bytes(feedbackURI).length > 0, "Feedback URI required");
        require(!hasReviewed[agentId][msg.sender], "Already reviewed");

        Feedback memory newFeedback = Feedback({
            reviewer: msg.sender,
            score: score,
            feedbackURI: feedbackURI,
            proofOfPayment: proofOfPayment,
            timestamp: block.timestamp,
            revoked: false
        });

        agentFeedback[agentId].push(newFeedback);
        hasReviewed[agentId][msg.sender] = true;

        // Update reputation summary
        _updateReputation(agentId);

        emit FeedbackSubmitted(
            agentId,
            msg.sender,
            score,
            feedbackURI,
            proofOfPayment
        );
    }

    /**
     * @dev Revoke your own feedback
     */
    function revokeFeedback(uint256 agentId, uint256 feedbackIndex) external {
        require(
            feedbackIndex < agentFeedback[agentId].length,
            "Invalid feedback index"
        );
        
        Feedback storage feedback = agentFeedback[agentId][feedbackIndex];
        require(feedback.reviewer == msg.sender, "Not your feedback");
        require(!feedback.revoked, "Already revoked");

        feedback.revoked = true;
        hasReviewed[agentId][msg.sender] = false;

        _updateReputation(agentId);

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @dev Get all feedback for an agent
     */
    function getAgentFeedback(uint256 agentId)
        external
        view
        returns (Feedback[] memory)
    {
        return agentFeedback[agentId];
    }

    /**
     * @dev Get reputation summary
     */
    function getReputation(uint256 agentId)
        external
        view
        returns (ReputationSummary memory)
    {
        return reputations[agentId];
    }

    /**
     * @dev Internal: Update reputation score
     */
    function _updateReputation(uint256 agentId) internal {
        Feedback[] memory feedbacks = agentFeedback[agentId];
        
        uint256 totalScore = 0;
        uint256 validCount = 0;

        for (uint256 i = 0; i < feedbacks.length; i++) {
            if (!feedbacks[i].revoked) {
                totalScore += feedbacks[i].score;
                validCount++;
            }
        }

        uint256 avgScore = validCount > 0 ? totalScore / validCount : 0;

        reputations[agentId] = ReputationSummary({
            totalFeedback: validCount,
            averageScore: avgScore,
            lastUpdated: block.timestamp
        });
    }
}
