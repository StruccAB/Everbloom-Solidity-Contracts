import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import {
  CREATOR_ROLE,
  DEFAULT_ADMIN_ROLE,
  deployContracts,
  getAccessControlRevertReason,
  SUB_ADMIN_ROLE
} from "./util";


describe("Access Control", function () {
  describe("Deployment", function () {
    it("Should set the admin, creator and sub admin role for owner", async function () {
      const { everDropManager, owner } = await loadFixture(deployContracts);
      const isOwnerAdmin = await everDropManager.hasRole(
          DEFAULT_ADMIN_ROLE,
          owner.address
      );
      const isOwnerSubAdmin = await everDropManager.hasRole(
          SUB_ADMIN_ROLE,
          owner.address
      );
      const isOwnerCreator = await everDropManager.hasRole(
          CREATOR_ROLE,
          owner.address
      );

      expect(isOwnerAdmin).to.equal(true);
      expect(isOwnerSubAdmin).to.equal(true);
      expect(isOwnerCreator).to.equal(true);
    });

    it("Should not set the creator and sub admin role for user", async function () {
      const { everDropManager, user1 } = await loadFixture(deployContracts);
      const isOwnerAdmin = await everDropManager.hasRole(
          DEFAULT_ADMIN_ROLE,
          user1.address
      );
      const isOwnerSubAdmin = await everDropManager.hasRole(
          SUB_ADMIN_ROLE,
          user1.address
      );
      const isOwnerCreator = await everDropManager.hasRole(
          CREATOR_ROLE,
          user1.address
      );

      expect(isOwnerAdmin).to.equal(false);
      expect(isOwnerSubAdmin).to.equal(false);
      expect(isOwnerCreator).to.equal(false);
    });
  });

  describe("Access Control", function () {
    describe("Validations", function () {
      it("Should grant sub admin role when called by admin", async function () {
        const { everDropManager, subAdmin1 } = await loadFixture(deployContracts);

        await expect(await everDropManager.addSubAdmin(subAdmin1.address)).to.be.not.reverted;
        await expect(await everDropManager.hasRole(
            SUB_ADMIN_ROLE,
            subAdmin1.address
        )).to.equal(true);
      });

      it("Should revoke sub admin role when called by admin", async function () {
        const { everDropManager, subAdmin1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address)

        await expect(await everDropManager.removeSubAdmin(subAdmin1.address)).to.be.not.reverted;
        await expect(await everDropManager.hasRole(
            SUB_ADMIN_ROLE,
            subAdmin1.address
        )).to.equal(false);
      });

      it("Should not grant sub admin role when called by another sub admin", async function () {
        const { everDropManager, subAdmin1, subAdmin2 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);

        await expect(everDropManager.connect(subAdmin1).addSubAdmin(
            subAdmin2.address
        )).to.be.revertedWith(getAccessControlRevertReason(subAdmin1.address, DEFAULT_ADMIN_ROLE));
      });

      it("Should not revoke sub admin role when called by another sub admin", async function () {
        const { everDropManager, subAdmin1, subAdmin2 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.addSubAdmin(subAdmin2.address);

        await expect(everDropManager.connect(subAdmin1).removeSubAdmin(
            subAdmin2.address
        )).to.be.revertedWith(getAccessControlRevertReason(subAdmin1.address, DEFAULT_ADMIN_ROLE));
      });

      it("Should grant creator roles when called by sub admin", async function () {
        const { everDropManager, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address)

        await expect(await everDropManager.hasRole(
            CREATOR_ROLE,
            creator1.address
        )).to.equal(false);
        await expect(everDropManager.connect(subAdmin1).addCreator(creator1.address)).to.be.not.reverted;
        await expect(await everDropManager.hasRole(
            CREATOR_ROLE,
            creator1.address
        )).to.equal(true);
      });

      it("Should revoke creator roles when called by sub admin", async function () {
        const { everDropManager, subAdmin1, creator1 } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address)
        await everDropManager.connect(subAdmin1).addCreator(creator1.address)

        await expect(await everDropManager.hasRole(
            CREATOR_ROLE,
            creator1.address
        )).to.equal(true);
        await expect(everDropManager.connect(subAdmin1).removeCreator(creator1.address)).to.be.not.reverted;
        await expect(await everDropManager.hasRole(
            CREATOR_ROLE,
            creator1.address
        )).to.equal(false);
      });

      it("Should not grant roles when called by user", async function () {
        const { everDropManager, user1, user2 } = await loadFixture(deployContracts);
        const subAdminHexString = ethers.utils.hexValue(SUB_ADMIN_ROLE);

        await expect(everDropManager.connect(user1).addSubAdmin(user2.address))
            .to.be.revertedWith(getAccessControlRevertReason(user1.address, DEFAULT_ADMIN_ROLE));
        await expect(everDropManager.connect(user1).addCreator(user2.address))
            .to.be.revertedWith(getAccessControlRevertReason(user1.address, subAdminHexString));
      });

      it("Should not grant roles when called by creator", async function () {
        const { everDropManager, creator1, user1 } = await loadFixture(deployContracts);
        const roleHexString = ethers.utils.hexValue(SUB_ADMIN_ROLE);
        await everDropManager.addCreator(creator1.address);

        await expect(everDropManager.connect(creator1).addSubAdmin(user1.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, DEFAULT_ADMIN_ROLE));
        await expect(everDropManager.connect(creator1).addCreator(user1.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, roleHexString));
      });

      it("Should not revoke roles when called by user", async function () {
        const { everDropManager, creator1, user1 } = await loadFixture(deployContracts);
        const roleHexString = ethers.utils.hexValue(SUB_ADMIN_ROLE);
        await everDropManager.addCreator(creator1.address);

        await expect(everDropManager.connect(user1).removeCreator(creator1.address))
            .to.be.revertedWith(getAccessControlRevertReason(user1.address, roleHexString))
      });

      it("Should not revoke roles when called by creator", async function () {
        const { everDropManager, creator1, creator2 } = await loadFixture(deployContracts);
        const roleHexString = ethers.utils.hexValue(SUB_ADMIN_ROLE);
        await everDropManager.addCreator(creator1.address);
        await everDropManager.addCreator(creator2.address);

        await expect(everDropManager.connect(creator1).removeSubAdmin(creator2.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, DEFAULT_ADMIN_ROLE));
        await expect(everDropManager.connect(creator1).removeCreator(creator2.address))
            .to.be.revertedWith(getAccessControlRevertReason(creator1.address, roleHexString));
      });
    });

    describe("events", function () {
      it("Should emit an event on granting roles", async function () {
        const { everDropManager, owner, subAdmin1, creator1 } = await loadFixture(deployContracts);

        await expect(await everDropManager.addSubAdmin(subAdmin1.address))
            .to.emit(everDropManager, "RoleGranted")
            .withArgs(SUB_ADMIN_ROLE, subAdmin1.address, owner.address);
        await expect(await everDropManager.addCreator(creator1.address))
            .to.emit(everDropManager, "RoleGranted")
            .withArgs(CREATOR_ROLE, creator1.address, owner.address);
      });

      it("Should emit an event on revoking roles", async function () {
        const { everDropManager, subAdmin1, creator1, owner } = await loadFixture(deployContracts);
        await everDropManager.addSubAdmin(subAdmin1.address);
        await everDropManager.addCreator(creator1.address);

        await expect(await everDropManager.removeSubAdmin(subAdmin1.address))
            .to.emit(everDropManager, "RoleRevoked")
            .withArgs(SUB_ADMIN_ROLE, subAdmin1.address, owner.address);
        await expect(await everDropManager.removeCreator(creator1.address))
            .to.emit(everDropManager, "RoleRevoked")
            .withArgs(CREATOR_ROLE, creator1.address, owner.address);
      });
    });
  });
});
