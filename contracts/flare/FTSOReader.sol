/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

import "@flarenetwork/flare-periphery-contracts/coston2/IFlareContractRegistry.sol";

interface IFtsoV2 {
    function getFeedById(bytes21 _feedId) external payable returns (uint256 _value, int8 _decimals, uint64 _timestamp);
    function getFeedByIdInWei(bytes21 _feedId) external payable returns (uint256 _value, uint64 _timestamp);
}

contract FTSOReader {
    address private constant FLARE_CONTRACT_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    
    struct PriceSnapshot {
        uint256 price;
        uint256 timestamp;
        int8 decimals;
        uint256 snapshotId;
        bool isValid;
        bytes21 feedId;
    }
    
    mapping(uint256 => PriceSnapshot) public snapshots;
    uint256 public nextSnapshotId = 1;
    
    event PriceSnapshotTaken(uint256 indexed snapshotId, bytes21 feedId, uint256 price, uint256 timestamp);
    
    function snapshot(bytes21 feedId) external payable returns (uint256 snapshotId) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IFtsoV2 ftsoV2 = IFtsoV2(contractRegistry.getContractAddressByName('FtsoV2'));
        
        (uint256 price, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById{value: msg.value}(feedId);
        
        snapshotId = nextSnapshotId++;
        snapshots[snapshotId] = PriceSnapshot({
            price: price,
            timestamp: timestamp,
            decimals: decimals,
            snapshotId: snapshotId,
            isValid: true,
            feedId: feedId
        });
        
        emit PriceSnapshotTaken(snapshotId, feedId, price, timestamp);
    }
    
    function getSnapshot(uint256 snapshotId) external view returns (PriceSnapshot memory) {
        return snapshots[snapshotId];
    }
    
    function getCurrentPrice(bytes21 feedId) external payable returns (uint256 price, int8 decimals, uint64 timestamp) {
        IFlareContractRegistry contractRegistry = IFlareContractRegistry(FLARE_CONTRACT_REGISTRY);
        IFtsoV2 ftsoV2 = IFtsoV2(contractRegistry.getContractAddressByName('FtsoV2'));
        
        return ftsoV2.getFeedById{value: msg.value}(feedId);
    }
}