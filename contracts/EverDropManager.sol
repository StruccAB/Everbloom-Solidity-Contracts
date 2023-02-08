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
    EverErrors,
    IEverDropManager
{
    // @dev hash of Creator role
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");
    // @dev hash of Sub admin role
    bytes32 public constant SUB_ADMIN_ROLE = keccak256("SUB_ADMIN_ROLE");
    // @dev Stores the drops
    Drop[] public drops;
    // @dev stores the Mapping (Everbloom ID) => Drop ID
    mapping (string => uint256) public externalIdToDropId;

    // -------------------- constructor -------------------- //

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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
        __ERC165Storage_init();
        _setRoleAdmin(SUB_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(CREATOR_ROLE, SUB_ADMIN_ROLE);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
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
     * @param _erc20tokenAddress : address of ERC20 in which payment will be made
     * @param _erc20tokenDenominator : denominator of the supported payment ERC20 token
     * @param _supply : total number of NFT for this drop (accross all associated tokenId)
     * @param _royaltySharePerToken : total percentage of royalty evenly distributed among NFT holders
     * @param _externalId : id of the print in legacy app
     * @param _saleInfo : array containing [_saleOpenTime, _saleCloseTime, _privateSaleOpenTime, _privateSaleMaxMint]
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
        uint64[4] calldata _saleInfo,
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
        drops.push(Drop(
            dropId,
            0,
            _saleInfo[0],
            _saleInfo[1],
            _saleInfo[2],
            _saleInfo[3],
            TokenInfo(
                _price,
                _erc20tokenAddress,
                _erc20tokenDenominator,
                _supply,
                _royaltySharePerToken
            ),
            _externalId,
            _owner,
            _nft,
            _merkle
        ));
        externalIdToDropId[_externalId] = dropId;

        emit NewDrop(dropId, _externalId, _nft);
    }

    // -------------------- Sub Admin-Only Functions -------------------- //

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
     * @param _privateSaleOpenTime : opening timestamp of the private sale
     * @param _privateSaleMaxMint : max mintable NFT under an address during a private sale. 0 means no limit
     */
    function setSalesInfo(
        uint256 _dropId,
        uint64 _saleOpenTime,
        uint64 _saleCloseTime,
        uint64 _privateSaleOpenTime,
        uint64 _privateSaleMaxMint
    )
    external
    onlyRole(SUB_ADMIN_ROLE)
    {
        drops[_dropId].saleOpenTime = _saleOpenTime;
        drops[_dropId].saleCloseTime = _saleCloseTime;
        drops[_dropId].privateSaleOpenTime = _privateSaleOpenTime;
        drops[_dropId].privateSaleMaxMint = _privateSaleMaxMint;

        emit DropSaleInfoUpdated(
            _dropId,
            _saleOpenTime,
            _saleCloseTime,
            _privateSaleOpenTime,
            _privateSaleMaxMint
        );
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
}
