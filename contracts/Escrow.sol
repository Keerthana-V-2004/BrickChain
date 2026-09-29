// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
}

/// @title Escrow
/// @notice Coordinates a real-estate sale between seller, buyer, inspector
/// and lender. Funds and the NFT sit in this contract until every party has
/// signed off, then the sale finalizes atomically.
contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "only buyer can call this method");
        _;
    }

    modifier onlySeller() {
        require(msg.sender == seller, "only seller can call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "only inspector can call this method");
        _;
    }

    mapping(uint256 => bool) public isListed;
    mapping(uint256 => uint256) public purchasePrice;
    mapping(uint256 => uint256) public escrowAmount;
    mapping(uint256 => address) public buyer;
    mapping(uint256 => bool) public inspectionPassed;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    /// @notice Seller lists a property: NFT moves into escrow, terms are set.
    function list(
        uint256 _nftID,
        address _buyer,
        uint256 _purchasePrice,
        uint256 _escrowAmount
    ) public onlySeller {
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);

        isListed[_nftID] = true;
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
        buyer[_nftID] = _buyer;
    }

    /// @notice Buyer deposits the earnest money into escrow.
    function depositEarnest(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(msg.value >= escrowAmount[_nftID], "deposit must be >= escrow amount");
    }

    /// @notice Inspector records the outcome of the property inspection.
    function updateInspectionStatus(uint256 _nftID, bool _passed) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    /// @notice Any party (buyer, seller, lender) approves the sale.
    function approveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    /// @notice Lender sends the remaining funds (purchase price - deposit).
    receive() external payable {}

    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Executes the sale once inspection passed, all parties
    /// approved, and the full purchase price is in the contract.
    function finalizeSale(uint256 _nftID) public {
        require(inspectionPassed[_nftID], "inspection not passed");
        require(approval[_nftID][buyer[_nftID]], "buyer has not approved");
        require(approval[_nftID][seller], "seller has not approved");
        require(approval[_nftID][lender], "lender has not approved");
        require(address(this).balance >= purchasePrice[_nftID], "insufficient funds");

        isListed[_nftID] = false;

        (bool success, ) = seller.call{value: address(this).balance}("");
        require(success, "transfer to seller failed");

        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    /// @notice Cancels the sale. If inspection failed, buyer's deposit is
    /// refunded; otherwise the deposit is forfeited to the seller.
    function cancelSale(uint256 _nftID) public {
        if (!inspectionPassed[_nftID]) {
            payable(buyer[_nftID]).transfer(address(this).balance);
        } else {
            seller.transfer(address(this).balance);
        }
    }
}
