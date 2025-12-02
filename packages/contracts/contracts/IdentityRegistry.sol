// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title IdentityRegistry
 * @dev ERC-721 based identity registry for AI agents (ERC-8004)
 */
contract IdentityRegistry is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct AgentMetadata {
        string name;
        string metadataURI; // IPFS URI
        address walletAddress;
        uint256 registeredAt;
        bool isActive;
    }

    mapping(uint256 => AgentMetadata) public agents;
    mapping(address => uint256) public addressToAgentId;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name,
        string metadataURI
    );

    event AgentUpdated(
        uint256 indexed agentId,
        string metadataURI
    );

    event AgentDeactivated(uint256 indexed agentId);

    constructor() ERC721("TravelWise Agent Identity", "TWAGENT") {}

    /**
     * @dev Register a new agent
     * @param name Agent name
     * @param metadataURI IPFS URI containing agent details
     * @param walletAddress Agent's payment wallet
     * @return agentId The newly created agent ID
     */
    function registerAgent(
        string memory name,
        string memory metadataURI,
        address walletAddress
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(metadataURI).length > 0, "Metadata URI required");
        require(walletAddress != address(0), "Invalid wallet address");
        require(addressToAgentId[msg.sender] == 0, "Agent already registered");

        _tokenIds.increment();
        uint256 newAgentId = _tokenIds.current();

        _safeMint(msg.sender, newAgentId);

        agents[newAgentId] = AgentMetadata({
            name: name,
            metadataURI: metadataURI,
            walletAddress: walletAddress,
            registeredAt: block.timestamp,
            isActive: true
        });

        addressToAgentId[msg.sender] = newAgentId;

        emit AgentRegistered(newAgentId, msg.sender, name, metadataURI);

        return newAgentId;
    }

    /**
     * @dev Update agent metadata
     */
    function updateMetadata(
        uint256 agentId,
        string memory metadataURI
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        require(agents[agentId].isActive, "Agent not active");

        agents[agentId].metadataURI = metadataURI;

        emit AgentUpdated(agentId, metadataURI);
    }

    /**
     * @dev Deactivate an agent
     */
    function deactivateAgent(uint256 agentId) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        
        agents[agentId].isActive = false;

        emit AgentDeactivated(agentId);
    }

    /**
     * @dev Get agent details
     */
    function getAgent(uint256 agentId)
        external
        view
        returns (AgentMetadata memory)
    {
        require(_exists(agentId), "Agent does not exist");
        return agents[agentId];
    }

    /**
     * @dev Get total registered agents
     */
    function totalAgents() external view returns (uint256) {
        return _tokenIds.current();
    }
}
