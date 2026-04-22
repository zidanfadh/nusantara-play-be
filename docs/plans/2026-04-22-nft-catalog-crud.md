# CRUD NFT Catalog Backend With Admin Upload

## Summary

Build an NFT catalog module for informational NFT entries only. It stores NFT descriptions, About content, blockchain details, optional PROT relation, and external purchase/listing links such as OpenSea. There are no NFT transactions, wallet flows, minting, checkout, or on-chain writes.

NFT images can be supplied either as existing URLs or uploaded through an admin-only NFT media endpoint. Public users can read published NFT entries. Only `admin_kpoti` can manage NFT data and NFT media.

## Key Changes

- Add a new `nfts` module with controller, service, DTOs, entity, migration, and unit tests.
- Register `NftsModule` in `AppModule`.
- Import `StorageModule` into `NftsModule` so NFT media upload reuses the existing S3 `StorageService`.
- Add `nft_catalog` table with:
  - `id`, `nama`, `slug`, `deskripsi`, `about`
  - `image_url`, `gallery_urls`
  - `blockchain_network`, `contract_address`, `token_id`, `token_standard`, `metadata_uri`
  - `marketplace_name`, `marketplace_url`, optional `external_url`
  - optional `prot_id` foreign key to `prot(id)` with `ON DELETE SET NULL`
  - `status`: `DRAFT` or `PUBLISHED`
  - `is_active`, `created_by`, `updated_by`, `published_at`, `created_at`, `updated_at`
- Add constraints/indexes:
  - unique `slug`
  - indexes for `status`, `is_active`, `blockchain_network`, `prot_id`
  - unique composite for `blockchain_network + contract_address + token_id` to avoid duplicate NFT records.

## API Behavior

- Public read endpoints:
  - `GET /api/nfts`
    - Returns only `PUBLISHED` and active NFTs.
    - Supports `search`, `blockchain_network`, `prot_id`, `page`, `limit`.
  - `GET /api/nfts/:id`
    - Returns only published active NFT for public access.
  - `GET /api/nfts/slug/:slug`
    - Returns only published active NFT for public access.

- Admin CRUD endpoints:
  - `POST /api/nfts`
    - Admin-only.
    - Creates NFT as `DRAFT`.
    - Accepts `image_url` and `gallery_urls` if frontend already has URLs.
  - `PATCH /api/nfts/:id`
    - Admin-only.
    - Updates metadata and media URL fields.
    - `gallery_urls` is treated as the final replacement array.
  - `POST /api/nfts/:id/publish`
    - Admin-only.
    - Sets `status = PUBLISHED` and `published_at = now`.
  - `POST /api/nfts/:id/unpublish`
    - Admin-only.
    - Sets `status = DRAFT` and clears `published_at`.
  - `DELETE /api/nfts/:id`
    - Admin-only.
    - Soft deletes with `is_active = false`.

- Admin upload endpoint:
  - `POST /api/nfts/upload/image`
    - Admin-only.
    - Multipart field: `file`.
    - Uploads to S3 folder `images/nfts`.
    - Returns `{ url, message }`.
    - Frontend can use the returned URL as `image_url` or include it inside `gallery_urls`.

## Validation Rules

- `nama`: required string, max 200.
- `slug`: required lowercase URL-safe string, max 200, unique.
- `deskripsi`, `about`: optional text.
- `image_url`, `marketplace_url`, `external_url`, `metadata_uri`: optional URL strings.
- `gallery_urls`: optional array of URL strings.
- Uploaded NFT images use existing storage validation: JPEG, JPG, PNG, WEBP supported by current `StorageService`.
- `blockchain_network`, `contract_address`, `token_id`: required strings.
- `token_standard`: optional string such as `ERC721`, `ERC1155`, or another chain-specific standard.
- `marketplace_name`: optional string; `OpenSea` is allowed but not hardcoded as the only marketplace.
- `prot_id`: optional UUID; service validates the PROT exists when provided.
- `status` is controlled only by publish/unpublish endpoints, not arbitrary create/update payloads.

## Test Plan

- Unit test `NftsService`:
  - creates draft NFT with `created_by`
  - rejects duplicate slug
  - rejects duplicate blockchain identity
  - validates optional `prot_id`
  - lists only published active NFTs for public queries
  - updates NFT fields and replaces `gallery_urls`
  - publishes and unpublishes correctly
  - soft deletes with `is_active = false`.

- Unit/controller-level tests for upload behavior:
  - admin can upload NFT image and receives URL
  - missing file returns `BadRequestException`
  - non-admin roles are rejected by `RolesGuard`.

- Run:
  - `npm test -- nfts`
  - `npm run build`

## Assumptions

- NFT image upload is separate from NFT create/update.
- Frontend flow is: upload image first, receive URL, then send URL in `POST /api/nfts` or `PATCH /api/nfts/:id`.
- Gallery updates replace the full `gallery_urls` array.
- Uploaded NFT media is public-read, matching current image upload behavior.
- Delete does not automatically delete S3 media; media cleanup remains explicit to avoid accidental removal of reused assets.
