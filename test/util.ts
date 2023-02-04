import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { EverDropManager, EverNFT, USDC } from "../typechain-types";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";

export const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
export const SUB_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SUB_ADMIN_ROLE'));
export const CREATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('CREATOR_ROLE'));
export const ERC_20_DECIMAL_POINT = 1_000_000;
export const BASE_URI = 'https://api.everbloom.app/';
export const NFT_NAME = 'EverNFT';
export const NFT_SYMBOL = 'EverNFT';
export const NFT_PRICE = 100 * ERC_20_DECIMAL_POINT;
export const NFT_SUPPLY = 100;
export const NFT_ROYALTY_PER_SHARE = 1;
export const NFT_SALE_OPEN_TIME = Math.floor(Date.now() / 1000);
export const NFT_SALE_CLOSE_TIME = Math.floor(new Date('2099-1-1').getTime() / 1000);
export const NFT_MERKLE_ROOT = ethers.constants.HashZero;

export const getExternalId = (number = 1) => `EXTERNAL_ID_${number}`;
export const getAccessControlRevertReason = (address: string, roleHexString: string) =>
    `AccessControl: account ${address.toLowerCase()} is missing role ${roleHexString}`;

export async function deployContracts() {
    const [owner, subAdmin1, subAdmin2, creator1, creator2, user1, user2] = await ethers.getSigners();

    const EverDropManager = await ethers.getContractFactory("EverDropManager");
    const EverNFT = await ethers.getContractFactory("EverNFT");
    const EverErrors = await ethers.getContractFactory("EverErrors");
    const Usdc = await ethers.getContractFactory("USDC");

    const everErrors = await EverErrors.deploy();
    const usdc = await Usdc.deploy(owner.address);
    const everDropManager = await upgrades.deployProxy(EverDropManager, [owner.address], { kind: 'uups' });
    const everNFT = await upgrades.deployProxy(
        EverNFT,
        [everDropManager.address, usdc.address, owner.address, BASE_URI, NFT_NAME, NFT_SYMBOL],
        { kind: 'uups' },
    );

    return {
        everDropManager,
        everNFT,
        everErrors,
        usdc,
        owner,
        creator1,
        creator2,
        user1,
        user2,
        subAdmin1,
        subAdmin2,
    };
}

export const transferToken = (
    usdc: USDC,
    from: SignerWithAddress,
    to: SignerWithAddress,
    amount: number
) => {
    return usdc.connect(from).transfer(to.address, amount);
}

export const approveToken = (
    usdc: USDC,
    from: SignerWithAddress,
    to: string,
    amount: number
) => {
    return usdc.connect(from).approve(to, amount)
}

export const deployContractV2 = (everDropManagerAddress: string) => {
    async function deploy() {
        const EverDropManager2 = await ethers.getContractFactory("EverDropManager2");
        const everDropManager2 = await upgrades.upgradeProxy(everDropManagerAddress, EverDropManager2);

        return {
            everDropManager2,
        }
    }

    return loadFixture(deploy);
}


export async function createDrop(
    everDropManager: Contract,
    everNFT: Contract,
    creator: SignerWithAddress,
    updates: Partial<{
        nftAddress: string;
        price: number,
        supply: number,
        royaltyPerShare: number,
        externalId: string,
        saleOpenTime: number;
        saleCloseTime: number;
        merkleRoot: string;
    }> = {}
) {
    return everDropManager.connect(creator).create(
        creator.address,
        updates.nftAddress || everNFT.address,
        updates.price !== undefined ? updates.price : NFT_PRICE,
        updates.supply !== undefined ? updates.supply : NFT_SUPPLY,
        updates.royaltyPerShare || NFT_ROYALTY_PER_SHARE,
        updates.externalId || getExternalId(),
        updates.saleOpenTime || NFT_SALE_OPEN_TIME,
        updates.saleCloseTime || NFT_SALE_CLOSE_TIME,
        updates.merkleRoot || NFT_MERKLE_ROOT,
    );
}

export async function mintNFTs(
    everNFT: Contract,
    buyer: SignerWithAddress,
    dropId: number,
    quantity: number,
    merkleProof: string[] = [NFT_MERKLE_ROOT],
) {
    return everNFT.connect(buyer).mint(
        buyer.address,
        dropId,
        quantity,
        merkleProof,
    )
}

export async function getIneligibilityMintNFTs(
    everNFT: Contract,
    buyer: SignerWithAddress,
    dropId: number,
    quantity: number,
    merkleProof: string[] = [NFT_MERKLE_ROOT],
) {
    return everNFT.connect(buyer).getIneligibilityReason(
        buyer.address,
        dropId,
        quantity,
        merkleProof,
    )
}

