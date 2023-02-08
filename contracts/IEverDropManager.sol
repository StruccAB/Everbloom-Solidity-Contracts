// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
 * @title EverDropManager
 * @author Everbloom
 * @notice Implementation of Everbloom Drop Manager. This contract handles
 * the managing of Drops, Creators and Sub Admins.
 * All the member of Everbloom Admin team has Sub Admin role
 * User can request Creator Role from Everbloom Admin team after joining the Everbloom Platform
 * Creators can create Drop which can be purchased from the EverNFT contract
 * Sub Admin have the permission to update some fields of the Drop i.e. right holder, sale info, supply and merkle root
 */
interface IEverDropManager {
    event NewDrop(uint256 indexed dropId, string externalId, address nftContractAddress);
    event DropSaleInfoUpdated(uint256 indexed dropId, uint64 saleOpenTime, uint64 saleCloseTime);
    event DropSupplyUpdated(uint256 indexed dropId, uint128 supply);
    event DropRightHolderUpdated(uint256 indexed dropId, address owner);
    event DropMerkleRootUpdated(uint256 indexed dropId, bytes32 merkleRoot);

    /**
     * @notice
     *  Drop Structure format
     *
     * @param dropId : drop unique identifier
     * @param sold : total number of sold tokens for this drop (accross all associated tokenId)
     * @param saleStartTime : opening timestamp of the sale
     * @param saleCloseTime : closing timestamp of the sale
     * @param tokenInfo : Token Info struct defining the token information (see TokenInfo structure)
     * @param externalId : id of the drop in Everbloom Platform
     * @param owner : right holder address
     * @param nft :  NFT contract address
     * @param merkleRoot : merkle root of the drop
     */
    struct Drop {
        uint256 dropId;
        uint128 sold;
        uint64 saleOpenTime;
        uint64 saleCloseTime;
        TokenInfo tokenInfo;
        string externalId;
        address owner;
        address nft;
        bytes32 merkleRoot;
    }

    /**
     * @notice
     *  TokenInfo Structure format
     *
     * @param price : initial price of 1 token
     * @param erc20tokenAddress : address of the supported payment ERC20 token for this drop
     * @param erc20tokenDenominator : denominator of the supported payment ERC20 token for this drop
     * @param supply : total number of tokens for this drop (across all associated tokenId)
     * @param royaltySharePerToken : total percentage of royalty evenly distributed among tokens holders
     */
    struct TokenInfo {
        uint256 price;
        address erc20tokenAddress;
        uint256 erc20tokenDenominator;
        uint128 supply;
        uint128 royaltySharePerToken;
    }

    // -------------------- User External Functions -------------------- //

    /**
     * @notice
     *  Returns the drop `_dropId`
     *
     * @param _dropId : drop identifier
     */
    function getDrop(uint _dropId) external view returns (Drop memory);

    /**
     * @notice
     *  Returns the drop by external id in legacy app
     *
     * @param _externalId : drop external identifier
     */
    function getDropByExternalId(string memory _externalId) external view returns (Drop memory);

    /**
     * @notice
     *  Update the sold counter of the drop
     *  Only Drop NFT contract can call this function
     *
     * @param _dropId : drop identifier
     * @param _quantity : amount of NFT sold
     */
    function updateDropCounter(uint256 _dropId, uint128 _quantity) external;

    // -------------------- Creator-Only Functions -------------------- //

    /**
     * @notice
     *  Create a Drop
     *
     * @param _owner : right holder address
     * @param _nft : NFT contract address
     * @param _price : initial price of 1 NFT
     * @param _erc20tokenAddress : address of ERC20 in which payment will be made
     * @param _erc20tokenDenominator : denominator of the supported payment ERC20 token
     * @param _supply : total number of NFT for this drop (accross all associated tokenId)
     * @param _royaltySharePerToken : total percentage of royalty evenly distributed among NFT holders
     * @param _externalId : id of the print in legacy app
     * @param _saleOpenTime : opening timestamp of the sale
     * @param _saleCloseTime : closing timestamp of the sale
     * @param _merkle : merkle root of the drop
     */
    function create(
        address _owner,
        address _nft,
        uint256 _price,
        address _erc20tokenAddress,
        uint256 _erc20tokenDenominator,
        uint128 _supply,
        uint128 _royaltySharePerToken,
        string memory _externalId,
        uint64 _saleOpenTime,
        uint64 _saleCloseTime,
        bytes32 _merkle
    ) external;

    // -------------------- Sub Admin-Only Functions -------------------- //

    /**
     * @notice
     *  Update the Drop `_dropId` right holder information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _owner : right holder address
     */
    function setRightHolderInfo(uint256 _dropId, address _owner) external;

    /**
     * @notice
     *  Update the Drop `_dropId` supply information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _supply : right holder address
     */
    function setSupply(uint256 _dropId, uint128 _supply) external;

    /**
     * @notice
     *  Update the Drop `_dropId` sale information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _saleOpenTime : opening timestamp of the sale
     * @param _saleCloseTime : closing timestamp of the sale
     */
    function setSalesInfo(uint256 _dropId, uint64 _saleOpenTime, uint64 _saleCloseTime) external;

    /**
     * @notice
     *  Update the Drop `_dropId` merkle root
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _merkle : merkle root of the drop
     */
    function setMerkleRoot(uint256 _dropId, bytes32 _merkle) external;
}
