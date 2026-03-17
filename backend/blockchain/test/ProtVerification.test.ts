import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('ProtVerification', function () {
  async function deployFixture() {
    const [owner, otherAccount] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('ProtVerification');
    const contract = await factory.deploy();
    return { contract, owner, otherAccount };
  }

  it('records a verification and increments version', async function () {
    const { contract, owner } = await deployFixture();
    const protId = '550e8400-e29b-41d4-a716-446655440000';
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes('test-data'));

    const tx = await contract.recordVerification(protId, dataHash);
    await tx.wait();

    expect(await contract.latestVersion(protId)).to.equal(1);
  });

  it('supports re-verification with incrementing versions', async function () {
    const { contract } = await deployFixture();
    const protId = '550e8400-e29b-41d4-a716-446655440000';
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('v1'));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('v2'));

    await (await contract.recordVerification(protId, hash1)).wait();
    await (await contract.recordVerification(protId, hash2)).wait();

    expect(await contract.latestVersion(protId)).to.equal(2);
    const record1 = await contract.getRecord(protId, 1);
    const record2 = await contract.getRecord(protId, 2);
    expect(record1.dataHash).to.equal(hash1);
    expect(record2.dataHash).to.equal(hash2);
  });

  it('getLatest returns the most recent record', async function () {
    const { contract } = await deployFixture();
    const protId = 'test-uuid-latest';
    const hash = ethers.keccak256(ethers.toUtf8Bytes('latest'));

    await (await contract.recordVerification(protId, hash)).wait();
    const latest = await contract.getLatest(protId);
    expect(latest.dataHash).to.equal(hash);
    expect(latest.version).to.equal(1);
  });

  it('getLatest reverts when no record exists', async function () {
    const { contract } = await deployFixture();
    await expect(contract.getLatest('nonexistent')).to.be.revertedWith('No record found');
  });

  it('keeps old records immutable after re-verification', async function () {
    const { contract } = await deployFixture();
    const protId = 'immutable-test';
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes('original'));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes('updated'));

    await (await contract.recordVerification(protId, hash1)).wait();
    await (await contract.recordVerification(protId, hash2)).wait();

    const original = await contract.getRecord(protId, 1);
    expect(original.dataHash).to.equal(hash1);
  });
});
