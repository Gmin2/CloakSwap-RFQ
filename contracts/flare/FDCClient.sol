/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol";

interface IFdcHub {
    function requestAttestation(bytes calldata _data) external payable returns (bool);
}

interface IFdcVerification {
    function verifyAttestationResponse(bytes calldata _response, bytes32[] calldata _proof, bytes32 _merkleRoot) external pure returns (bool);
}

contract FDCClient {
    address private constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    
    struct AttestationRequest {
        bytes32 requestId;
        bytes data;
        uint256 timestamp;
        uint256 votingRound;
        bool submitted;
    }
    
    mapping(bytes32 => AttestationRequest) public requests;
    
    event AttestationRequested(bytes32 indexed requestId, bytes data, uint256 timestamp);
    event AttestationVerified(bytes32 indexed requestId, bytes response, bool isValid);
    
    function requestAttestation(bytes calldata data) external payable returns (bytes32 requestId) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IFdcHub fdcHub = IFdcHub(contractRegistry.getContractAddressByName('FdcHub'));
        
        requestId = keccak256(abi.encodePacked(msg.sender, data, block.timestamp, block.number));
        
        bool success = fdcHub.requestAttestation{value: msg.value}(data);
        require(success, "Attestation request failed");
        
        requests[requestId] = AttestationRequest({
            requestId: requestId,
            data: data,
            timestamp: block.timestamp,
            votingRound: (block.timestamp / 90) + 1,
            submitted: true
        });
        
        emit AttestationRequested(requestId, data, block.timestamp);
    }
    
    function verifyAttestation(
        bytes32 requestId,
        bytes calldata response,
        bytes32[] calldata proof,
        bytes32 merkleRoot
    ) external returns (bool isValid) {
        require(requests[requestId].submitted, "Request not found");
        
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IFdcVerification fdcVerification = IFdcVerification(contractRegistry.getContractAddressByName('FdcVerification'));
        
        isValid = fdcVerification.verifyAttestationResponse(response, proof, merkleRoot);
        
        emit AttestationVerified(requestId, response, isValid);
    }
    
    function getRequest(bytes32 requestId) external view returns (AttestationRequest memory) {
        return requests[requestId];
    }
}