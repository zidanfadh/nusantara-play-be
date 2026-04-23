import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { NftsController } from '../nfts.controller';

const mockNftsService = {
  uploadImage: jest.fn(),
  findAll: jest.fn(),
  findAllForAdmin: jest.fn(),
  findOne: jest.fn(),
  findOneForAdmin: jest.fn(),
  findBySlug: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  unpublish: jest.fn(),
  remove: jest.fn(),
};

describe('NftsController', () => {
  let controller: NftsController;

  beforeEach(() => {
    controller = new NftsController(mockNftsService as any);
    jest.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('uploads NFT image and returns URL', async () => {
      const file = {
        originalname: 'nft.png',
        mimetype: 'image/png',
        buffer: Buffer.from('image'),
        size: 5,
      } as Express.Multer.File;

      mockNftsService.uploadImage.mockResolvedValue({
        url: 'https://example.com/images/nfts/nft.png',
        message: 'NFT image uploaded successfully',
      });

      await expect(controller.uploadImage(file)).resolves.toEqual({
        url: 'https://example.com/images/nfts/nft.png',
        message: 'NFT image uploaded successfully',
      });
      expect(mockNftsService.uploadImage).toHaveBeenCalledWith(file);
    });

    it('throws BadRequestException when file is missing', () => {
      expect(() => controller.uploadImage(undefined as unknown as Express.Multer.File)).toThrow(
        BadRequestException,
      );
    });

    it('is restricted to admin_kpoti role', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, NftsController.prototype.uploadImage);
      expect(roles).toEqual([UserRole.ADMIN_KPOTI]);
    });
  });

  describe('admin reads', () => {
    it('lists draft and published NFTs through admin endpoint', () => {
      const query = { page: 1, limit: 20 };

      controller.findAllForAdmin(query);

      expect(mockNftsService.findAllForAdmin).toHaveBeenCalledWith(query);
    });

    it('gets active draft NFT detail through admin endpoint', () => {
      controller.findOneForAdmin('550e8400-e29b-41d4-a716-446655440000');

      expect(mockNftsService.findOneForAdmin).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('restricts admin listing to admin_kpoti role', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, NftsController.prototype.findAllForAdmin);
      expect(roles).toEqual([UserRole.ADMIN_KPOTI]);
    });
  });
});
