/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol";

interface IRandomNumberV2 {
    function getRandomNumber() external view returns (uint256 _randomNumber, bool _isSecureRandom, uint256 _randomTimestamp);
    function getRandomNumberHistorical(uint256 _votingRoundId) external view returns (uint256 _randomNumber, bool _isSecureRandom, uint256 _randomTimestamp);
}

contract RNGReader {
    address private constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    
    struct RandomDraw {
        uint256 randomNumber;
        bool isSecure;
        uint256 timestamp;
        uint256 drawId;
        uint256 votingRoundId;
    }
    
    mapping(uint256 => RandomDraw) public draws;
    uint256 public nextDrawId = 1;
    
    event RandomDrawTaken(uint256 indexed drawId, uint256 randomNumber, bool isSecure, uint256 timestamp);
    
    function draw() external returns (uint256 drawId) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IRandomNumberV2 randomNumber = IRandomNumberV2(contractRegistry.getContractAddressByName('RandomNumberV2'));
        
        (uint256 randomValue, bool isSecure, uint256 timestamp) = randomNumber.getRandomNumber();
        
        drawId = nextDrawId++;
        draws[drawId] = RandomDraw({
            randomNumber: randomValue,
            isSecure: isSecure,
            timestamp: timestamp,
            drawId: drawId,
            votingRoundId: 0
        });
        
        emit RandomDrawTaken(drawId, randomValue, isSecure, timestamp);
    }
    
    function drawHistorical(uint256 votingRoundId) external returns (uint256 drawId) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IRandomNumberV2 randomNumber = IRandomNumberV2(contractRegistry.getContractAddressByName('RandomNumberV2'));
        
        (uint256 randomValue, bool isSecure, uint256 timestamp) = randomNumber.getRandomNumberHistorical(votingRoundId);
        
        drawId = nextDrawId++;
        draws[drawId] = RandomDraw({
            randomNumber: randomValue,
            isSecure: isSecure,
            timestamp: timestamp,
            drawId: drawId,
            votingRoundId: votingRoundId
        });
        
        emit RandomDrawTaken(drawId, randomValue, isSecure, timestamp);
    }
    
    function getDraw(uint256 drawId) external view returns (RandomDraw memory) {
        return draws[drawId];
    }
    
    function getCurrentRandomNumber() external view returns (uint256 randomNumber, bool isSecure, uint256 timestamp) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IRandomNumberV2 randomNumberContract = IRandomNumberV2(contractRegistry.getContractAddressByName('RandomNumberV2'));
        
        return randomNumberContract.getRandomNumber();
    }
}