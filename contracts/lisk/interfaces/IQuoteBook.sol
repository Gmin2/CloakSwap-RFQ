/** SPDX-License-Identifier: MIT */
pragma solidity 0.8.27;

interface IQuoteBook {
  struct Quote {
    address maker;
    uint256 quoteOut;
    bytes32 commitment;
    bool revealed;
    uint256 timestamp;
  }
  
  function commitQuote(uint256 rfqId, bytes32 commitment) external;
  function revealQuote(uint256 rfqId, uint256 quoteOut, bytes32 salt) external;
  function selectBest(uint256 rfqId, uint256 rngValue, bool isSecure, uint256 snapshotId, uint256 refPrice) external;
  function getSelectedQuote(uint256 rfqId) external view returns (Quote memory);
}