// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProtVerification {
    struct VerificationRecord {
        string  protId;
        uint32  version;
        bytes32 dataHash;
        address verifier;
        uint256 timestamp;
    }

    // protId => version => record
    mapping(string => mapping(uint32 => VerificationRecord)) public records;
    // protId => latest version number
    mapping(string => uint32) public latestVersion;

    event VerificationAnchored(
        string indexed protId,
        uint32 version,
        bytes32 dataHash,
        address indexed verifier,
        uint256 timestamp
    );

    function recordVerification(
        string calldata protId,
        bytes32 dataHash
    ) external returns (uint32 version) {
        version = latestVersion[protId] + 1;
        latestVersion[protId] = version;
        records[protId][version] = VerificationRecord({
            protId: protId,
            version: version,
            dataHash: dataHash,
            verifier: msg.sender,
            timestamp: block.timestamp
        });
        emit VerificationAnchored(protId, version, dataHash, msg.sender, block.timestamp);
    }

    function getRecord(
        string calldata protId,
        uint32 version
    ) external view returns (VerificationRecord memory) {
        return records[protId][version];
    }

    function getLatest(
        string calldata protId
    ) external view returns (VerificationRecord memory) {
        uint32 v = latestVersion[protId];
        require(v > 0, 'No record found');
        return records[protId][v];
    }
}
