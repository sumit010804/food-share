// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FoodShareEvents {
    address public owner;

    event FoodListed(bytes32 indexed listingId, string title, string location, uint256 timestamp, uint256 qtyKg);
    event FoodExpiringSoon(bytes32 indexed listingId, string title, string location, uint256 expiresAt);
    event EventListed(bytes32 indexed eventId, string title, string location, uint256 startAt, uint256 endAt, uint256 expectedSurplusKg);
    event EventStarted(bytes32 indexed eventId, uint256 timestamp);
    event EventEnded(bytes32 indexed eventId, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Emitters (only owner/relayer should call these)
    function emitFoodListed(bytes32 listingId, string calldata title, string calldata location, uint256 qtyKg) external onlyOwner {
        emit FoodListed(listingId, title, location, block.timestamp, qtyKg);
    }

    function emitFoodExpiringSoon(bytes32 listingId, string calldata title, string calldata location, uint256 expiresAt) external onlyOwner {
        emit FoodExpiringSoon(listingId, title, location, expiresAt);
    }

    function emitEventListed(bytes32 eventId, string calldata title, string calldata location, uint256 startAt, uint256 endAt, uint256 expectedSurplusKg) external onlyOwner {
        emit EventListed(eventId, title, location, startAt, endAt, expectedSurplusKg);
    }

    function emitEventStarted(bytes32 eventId) external onlyOwner {
        emit EventStarted(eventId, block.timestamp);
    }

    function emitEventEnded(bytes32 eventId) external onlyOwner {
        emit EventEnded(eventId, block.timestamp);
    }
}
