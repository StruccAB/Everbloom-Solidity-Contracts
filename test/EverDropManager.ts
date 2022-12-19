import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  createDrop,
  deployContracts,
  deployContractV2,
  getAccessControlRevertReason,
  getExternalId,
  SUB_ADMIN_ROLE
} from "./util";
import {StandardMerkleTree} from "@openzeppelin/merkle-tree";


describe("Ever Drop Manager", function () {
  describe("Deployment", function () {
    it("Should set init states", async function () {
      const { everDropManager } = await loadFixture(deployContracts);

      expect(await everDropManager.drops.length).to.equal(0);
      expect(await everDropManager.externalIdToDropId.length).to.equal(0);
    });
  });

  describe("Drop", function () {
    describe("Validations", function () {
      it("Should create a drop when called by creator", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1)).to.be.not.reverted;
        await expect(await everDropManager.drops(0)).to.be.not.null;
        await expect(await everDropManager.externalIdToDropId(getExternalId())).to.equal(0);
      });

      it("Should not create a drop when nft address is invalid", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, { nftAddress: creator1.address }))
            .to.be.reverted;
      });

      it("Should not create a drop when there is a conflict in external id", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, everErrors } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);
        await createDrop(everDropManager, everNFT, creator1, { externalId: getExternalId(1) })

        await expect(createDrop(everDropManager, everNFT, creator1, { externalId: getExternalId(1) }))
            .to.be.revertedWithCustomError(everErrors, 'DropConflict');
      });

      it("Should not create a drop when supply is zero", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1, everErrors } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);

        await expect(createDrop(everDropManager, everNFT, creator1, { supply: 0 }))
            .to.be.revertedWithCustomError(everErrors, 'InvalidSupply');
      });

      it("Should not create a drop when called by user", async function () {
        const { everDropManager, everNFT, user1 } = await loadFixture(deployContracts);

        await expect(createDrop(everDropManager, everNFT, user1)).to.be.reverted;
        await expect(await everDropManager.drops.length).to.equal(0);
      });

      it("Should update a drop when called by sub admin", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);
        await createDrop(everDropManager, everNFT, creator1);

        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [creator1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(subAdmin1).setSupply(dropId, UPDATES.supply)).to.be.not.reverted;
        await expect(everDropManager.connect(subAdmin1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate
        )).to.be.not.reverted;
        await expect(everDropManager.connect(subAdmin1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot,
        )).to.be.not.reverted;

        const [, , saleOpenTime, saleCloseTime, tokenInfo, , , , merkleRoot] = await everDropManager.drops(0);
        const newSupply = Number(tokenInfo.supply);
        const newSaleOpenTime = Number(saleOpenTime);
        const newSaleCloseTime = Number(saleCloseTime);
        const newMerkleRoot = String(merkleRoot);

        await expect(newSupply).to.equal(UPDATES.supply);
        await expect(newSaleOpenTime).to.equal(UPDATES.saleOpenDate);
        await expect(newSaleCloseTime).to.equal(UPDATES.saleCloseDate);
        await expect(newMerkleRoot).to.equal(UPDATES.merkleRoot);
      });

      it("Should update a drop owner when called by sub admin", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);
        await createDrop(everDropManager, everNFT, creator1);

        const drop = await everDropManager.drops(0);
        const dropId = parseInt(ethers.utils.formatEther(drop[0]));

        await expect(everDropManager.connect(subAdmin1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith('New owner is not a creator');
        await everDropManager.connect(subAdmin1).addCreator(subAdmin1.address);
        await expect(everDropManager.connect(subAdmin1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.not.reverted;

        const [, , , , , , owner] = await everDropManager.drops(0);

        await expect(owner).to.equal(subAdmin1.address);
      });

      it("Should not update drop when called by creator", async function () {
        const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(creator1.address);
        await createDrop(everDropManager, everNFT, creator1);
        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [creator1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(creator1).setSupply(dropId, UPDATES.supply)).to.be.reverted;
        await expect(everDropManager.connect(creator1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate
        )).to.be.reverted;
        await expect(everDropManager.connect(creator1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot
        )).to.be.reverted;
        await expect(everDropManager.connect(creator1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, ethers.utils.hexValue(SUB_ADMIN_ROLE)));
      });

      it("Should not update drop when called by user", async function () {
        const { everDropManager, everNFT, subAdmin1, user1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.connect(subAdmin1).addCreator(subAdmin1.address);
        await createDrop(everDropManager, everNFT, subAdmin1)
        const merkleTree = StandardMerkleTree.of(
            [[subAdmin1.address], [user1.address]],
            ['address']
        );
        const UPDATES = {
          supply: 10,
          saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
          merkleRoot: merkleTree.root
        }

        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.connect(user1).setSupply(dropId, UPDATES.supply)).to.be.reverted;
        await expect(everDropManager.connect(user1).setSalesInfo(
            dropId,
            UPDATES.saleOpenDate,
            UPDATES.saleCloseDate
        )).to.be.reverted;
        await expect(everDropManager.connect(user1).setMerkleRoot(
            dropId,
            UPDATES.merkleRoot
        )).to.be.reverted;
        await expect(everDropManager.connect(user1).setRightHolderInfo(dropId, subAdmin1.address))
            .to.be.revertedWith(getAccessControlRevertReason(user1.address, ethers.utils.hexValue(SUB_ADMIN_ROLE)));
      });
    });

    describe("events", function () {
      it("Should emit an event on creating a drop", async function () {
        const { everDropManager, everNFT, owner } = await loadFixture(deployContracts);

        await expect(createDrop(everDropManager, everNFT, owner))
            .to.emit(everDropManager, "NewDrop")
            .withArgs(0, getExternalId(), everNFT.address);
      });

      it("Should emit an event on updating drop supply", async function () {
        const { everDropManager, everNFT, owner } = await loadFixture(deployContracts);

        await createDrop(everDropManager, everNFT, owner)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const UPDATED_SUPPLY = 200;

        await expect(everDropManager.setSupply(dropId, UPDATED_SUPPLY))
            .to.emit(everDropManager, "DropSupplyUpdated")
            .withArgs(dropId, UPDATED_SUPPLY);
      });

      it("Should emit an event on updating drop sale info", async function () {
        const { everDropManager, everNFT, owner } = await loadFixture(deployContracts);

        await createDrop(everDropManager, everNFT, owner)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const UPDATED_SALE_OPEN_TIME = Math.floor(new Date('2023-1-1').getTime() / 1000);
        const UPDATED_CLOSE_TIME = Math.floor(new Date('2024-1-1').getTime() / 1000);

        await expect(everDropManager.setSalesInfo(dropId, UPDATED_SALE_OPEN_TIME, UPDATED_CLOSE_TIME))
            .to.emit(everDropManager, "DropSaleInfoUpdated")
            .withArgs(dropId, UPDATED_SALE_OPEN_TIME, UPDATED_CLOSE_TIME);
      });

      it("Should emit an event on updating drop right holder", async function () {
        const { everDropManager, everNFT, creator1, owner } = await loadFixture(deployContracts);
        await everDropManager.addCreator(creator1.address);

        await createDrop(everDropManager, everNFT, owner)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);

        await expect(everDropManager.setRightHolderInfo(dropId, creator1.address))
            .to.emit(everDropManager, "DropRightHolderUpdated")
            .withArgs(dropId, creator1.address);
      });

      it("Should emit an event on updating drop merkle", async function () {
        const { everDropManager, everNFT, creator1, owner } = await loadFixture(deployContracts);
        await everDropManager.addCreator(creator1.address);

        await createDrop(everDropManager, everNFT, owner)
        const drop = await everDropManager.drops(0);
        const dropId = Number(drop[0]);
        const merkleTree = StandardMerkleTree.of(
            [[owner.address], [creator1.address]],
            ['address']
        );
        await expect(everDropManager.setMerkleRoot(dropId, merkleTree.root))
            .to.emit(everDropManager, "DropMerkleRootUpdated")
            .withArgs(dropId, merkleTree.root);
      });
    });
  });

  describe("Drop Test v2", function () {
    it("Validation", async function () {
      const { everDropManager, everNFT, subAdmin1, creator1 } = await loadFixture(deployContracts);
      const { everDropManager2 } = await deployContractV2(everDropManager.address);
      await everDropManager2.addSubAdmin(subAdmin1.address);
      await everDropManager2.connect(subAdmin1).addCreator(creator1.address);

      await expect(everDropManager.address).to.equal(everDropManager2.address);
      await expect(createDrop(everDropManager2, everNFT, creator1)).to.be.not.reverted;

      const drop = await everDropManager2.drops(0);
      const dropId = Number(drop[0]);
      const UPDATES = {
        supply: 10,
        saleOpenDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
        saleCloseDate: Math.floor(new Date('2024-1-1').getTime() / 1000),
      }

      await expect(everDropManager2.connect(subAdmin1).updateDrop(
          dropId,
          UPDATES.saleOpenDate,
          UPDATES.saleCloseDate
      )).to.be.not.reverted;
    });
  });
});
