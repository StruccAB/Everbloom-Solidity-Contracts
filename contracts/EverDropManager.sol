// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165CheckerUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165StorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./IEverDropManager.sol";
import "./EverErrors.sol";
import "./IEverNFT.sol";

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
contract EverDropManager is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ERC165StorageUpgradeable,
    EverErrors
{
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
     * @param supply : total number of tokens for this drop (across all associated tokenId)
     * @param royaltySharePerToken : total percentage of royalty evenly distributed among tokens holders
     */
    struct TokenInfo {
        uint256 price;
        uint128 supply;
        uint128 royaltySharePerToken;
    }

    // @dev hash of Creator role
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    // @dev hash of Sub admin role
    bytes32 public constant SUB_ADMIN_ROLE = keccak256("SUB_ADMIN_ROLE");
    // @dev Stores the drops
    Drop[] public drops;
    // @dev stores the Mapping (Everbloom ID) => Drop ID
    mapping (string => uint256) public externalIdToDropId;

    // -------------------- Initializer Functions -------------------- //

    /**
     * @notice
     *  EverNFT contract initialize function
     *
     * @param _admin : address of the NFT contract admin
     **/
    function initialize(address _admin)
    public
    initializer
    {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CREATOR_ROLE, _admin);
        _grantRole(SUB_ADMIN_ROLE, _admin);
        // register the IEverDropManager Interface
        _registerInterface(
            type(IEverDropManager).interfaceId
        );
    }

    // -------------------- External Functions -------------------- //

    /**
     * @notice
     *  Returns the drop `_dropId`
     *
     * @param _dropId : drop identifier
     */
    function getDrop(uint _dropId)
    external
    view
    returns (Drop memory)
    {
        return drops[_dropId];
    }

    /**
     * @notice
     *  Returns the drop by external id in Everbloom Platform
     *
     * @param _externalId : drop external identifier
     */
    function getDropByExternalId(string memory _externalId)
    external
    view
    returns (Drop memory)
    {
        return drops[externalIdToDropId[_externalId]];
    }

    /**
     * @notice
     *  Update the sold counter of the drop
     *  Only Drop NFT contract can call this function
     *
     * @param _dropId : drop identifier
     * @param _quantity : amount of NFT sold
     */
    function updateDropCounter(uint256 _dropId, uint128 _quantity)
    external
    {
        Drop storage drop = drops[_dropId];

        // Ensure that the caller is the NFT contract associated to this drop
        if (msg.sender != drop.nft)
            revert UnauthorizedUpdate();

        if ((drop.sold + _quantity) > drop.tokenInfo.supply)
            revert NotEnoughTokensAvailable();

        drop.sold += _quantity;
    }

    // -------------------- Public Functions -------------------- //

    /**
     * @dev See {ERC721Enumerable-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(AccessControlUpgradeable, ERC165StorageUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // -------------------- Creator-Only Functions -------------------- //

    /**
     * @notice
     *  Create a Drop
     *  Only the contract CREATOR can perform this operation
     *
     * @param _owner : right holder address
     * @param _nft : NFT contract address
     * @param _price : initial price of 1 NFT
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
        uint128 _supply,
        uint128 _royaltySharePerToken,
        string memory _externalId,
        uint64 _saleOpenTime,
        uint64 _saleCloseTime,
        bytes32 _merkle
    )
    external
    onlyRole(CREATOR_ROLE)
    {
        require(hasRole(CREATOR_ROLE, _owner), "Owner is not a creator");
        // validate the non-zero drop supply
        if (_supply == 0)
            revert InvalidSupply();
        // check the conflict of drop external id
        if (externalIdToDropId[_externalId] != 0) {
            revert DropConflict(_externalId);
        }
        // validate the interface of _nft address
        if (!ERC165CheckerUpgradeable.supportsInterface(_nft, type(IEverNFT).interfaceId))
            revert InvalidInterface();

        uint dropId = drops.length;
        TokenInfo memory dropTokenInfo = TokenInfo(_price, _supply, _royaltySharePerToken);
        drops.push(Drop(dropId, 0, _saleOpenTime, _saleCloseTime, dropTokenInfo, _externalId, _owner, _nft, _merkle));
        externalIdToDropId[_externalId] = dropId;

        emit NewDrop(dropId, _externalId, _nft);
    }

    // -------------------- Sub Admin-Only Functions -------------------- //

    /**
     * @notice
     *  Grant Creator role to an address
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _creator : address of the creator
     */
    function addCreator(address _creator)
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        if (_creator == address(0)) revert ZeroAddress();
        _grantRole(CREATOR_ROLE, _creator);
    }

    /**
     * @notice
     *  Revoke Creator role for an address
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _creator : address of the creator
     */
    function removeCreator(address _creator)
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        _revokeRole(CREATOR_ROLE, _creator);
    }

    /**
     * @notice
     *  Update the Drop `_dropId` right holder information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _owner : right holder address
     */
    function setRightHolderInfo(
        uint256 _dropId,
        address _owner
    )
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        require(hasRole(CREATOR_ROLE, _owner), "New owner is not a creator");
        drops[_dropId].owner = _owner;

        emit DropRightHolderUpdated(_dropId, _owner);
    }

    /**
     * @notice
     *  Update the Drop `_dropId` supply information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _supply : right holder address
     */
    function setSupply(uint256 _dropId, uint128 _supply)
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        // validate the non-zero drop supply
        if (_supply == 0)
            revert InvalidSupply();
        drops[_dropId].tokenInfo.supply = _supply;

        emit DropSupplyUpdated(_dropId, _supply);
    }

    /**
     * @notice
     *  Update the Drop `_dropId` sale information
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _saleOpenTime : opening timestamp of the sale
     * @param _saleCloseTime : closing timestamp of the sale
     */
    function setSalesInfo(
        uint256 _dropId,
        uint64 _saleOpenTime,
        uint64 _saleCloseTime
    )
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        drops[_dropId].saleOpenTime = _saleOpenTime;
        drops[_dropId].saleCloseTime = _saleCloseTime;

        emit DropSaleInfoUpdated(_dropId, _saleOpenTime, _saleCloseTime);
    }

    /**
     * @notice
     *  Update the Drop `_dropId` merkle root
     *  Only the contract SUB_ADMIN_ROLE can perform this operation
     *
     * @param _dropId :  drop identifier of the drop to be updated
     * @param _merkle : merkle root of the drop
     */
    function setMerkleRoot(uint256 _dropId, bytes32 _merkle)
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        drops[_dropId].merkleRoot = _merkle;

        emit DropMerkleRootUpdated(_dropId, _merkle);
    }

    // -------------------- owner Functions -------------------- //

    /**
     * @dev See {UUPSUpgradeable-_authorizeUpgrade}.
     */
    function _authorizeUpgrade(address)
    internal
    override
    onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    /**
     * @notice
     *  Grant Sub Admin role for an address
     *  Only the contract owner can perform this operation
     *
     * @param _subAdmin : address of the Sub Admin
     */
    function addSubAdmin(address _subAdmin)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_subAdmin == address(0))
            revert ZeroAddress();
        _grantRole(SUB_ADMIN_ROLE, _subAdmin);
    }

    /**
     * @notice
     *  Revoke Sub Admin role for an address
     *  Only the contract owner can perform this operation
     *
     * @param _subAdmin : address of the Sub Admin
     */
    function removeSubAdmin(address _subAdmin)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(SUB_ADMIN_ROLE, _subAdmin);
    }
}
