// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/// @title RealEstate
/// @notice Each token represents a real-world property. Metadata (address,
/// photos, price, specs) lives at the tokenURI (typically pinned on IPFS).
contract RealEstate is ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum PropertyStatus { Pending, Verified, Rejected, Minted }

    struct PropertySubmission {
        address seller;
        string tokenURI;
        PropertyStatus status;
    }

    uint256 public submissionCount;
    mapping(uint256 => PropertySubmission) public submissions;

    event PropertySubmitted(uint256 indexed submissionId, address indexed seller, string tokenURI);
    event PropertyVerified(uint256 indexed submissionId, address indexed verifier);
    event PropertyRejected(uint256 indexed submissionId, address indexed verifier);
    event PropertyMinted(uint256 indexed submissionId, uint256 indexed tokenId, address indexed owner);

    constructor() ERC721("Real Estate", "REAL") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /// @notice Submit a property for review. No NFT exists until it is verified and minted.
    function submitProperty(string memory tokenURI) public returns (uint256) {
        submissionCount++;
        submissions[submissionCount] = PropertySubmission({
            seller: msg.sender,
            tokenURI: tokenURI,
            status: PropertyStatus.Pending
        });
        emit PropertySubmitted(submissionCount, msg.sender, tokenURI);
        return submissionCount;
    }

    /// @notice Approve a pending property submission.
    function verifyProperty(uint256 submissionId) public onlyRole(ADMIN_ROLE) {
        PropertySubmission storage sub = submissions[submissionId];
        require(sub.seller != address(0), "submission does not exist");
        require(sub.status == PropertyStatus.Pending, "not pending");
        sub.status = PropertyStatus.Verified;
        emit PropertyVerified(submissionId, msg.sender);
    }

    /// @notice Reject a pending property submission.
    function rejectProperty(uint256 submissionId) public onlyRole(ADMIN_ROLE) {
        PropertySubmission storage sub = submissions[submissionId];
        require(sub.seller != address(0), "submission does not exist");
        require(sub.status == PropertyStatus.Pending, "not pending");
        sub.status = PropertyStatus.Rejected;
        emit PropertyRejected(submissionId, msg.sender);
    }

    /// @notice Mint a verified submission to its original seller.
    function mintVerifiedProperty(uint256 submissionId) public returns (uint256) {
        PropertySubmission storage sub = submissions[submissionId];
        require(sub.seller == msg.sender, "only submitting seller can mint");
        require(sub.status == PropertyStatus.Verified, "property not verified");

        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);
        _setTokenURI(newItemId, sub.tokenURI);

        sub.status = PropertyStatus.Minted;
        emit PropertyMinted(submissionId, newItemId, msg.sender);
        return newItemId;
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
