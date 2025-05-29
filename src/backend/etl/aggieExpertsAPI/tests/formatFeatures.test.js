const { formatExpertProfilesToFeatures } = require('../services/formatFeatures');

describe('formatFeatures', () => {
  describe('formatExpertProfilesToFeatures', () => {
    it('should format expert profiles into works and grants features', () => {
      const mockProfiles = [
        {
          expertId: '123',
          fullName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          url: 'https://experts.ucdavis.edu/expert/123',
          works: [
            {
              id: 'w1',
              title: 'Research Paper 1',
              abstract: 'Abstract 1',
              issued: '2022'
            }
          ],
          grants: [
            {
              id: 'g1',
              title: 'Grant Project 1',
              funder: 'NSF',
              startDate: '2022-01-01',
              endDate: '2023-01-01'
            }
          ]
        }
      ];

      const result = formatExpertProfilesToFeatures(mockProfiles);

      // Check that works features are properly formatted
      expect(result.works).toHaveLength(1);
      expect(result.works[0]).toEqual({
        id: 'w1',
        title: 'Research Paper 1',
        abstract: 'Abstract 1',
        issued: '2022',
        relatedExperts: [
          {
            expertId: '123',
            fullName: 'John Doe',
            firstName: 'John',
            lastName: 'Doe',
            url: 'https://experts.ucdavis.edu/expert/123'
          }
        ]
      });

      // Check that grants features are properly formatted
      expect(result.grants).toHaveLength(1);
      expect(result.grants[0]).toEqual({
        id: 'g1',
        title: 'Grant Project 1',
        funder: 'NSF',
        start_date: '2022-01-01',
        end_date: '2023-01-01',
        relatedExperts: [
          {
            expertId: '123',
            fullName: 'John Doe',
            firstName: 'John',
            lastName: 'Doe',
            url: 'https://experts.ucdavis.edu/expert/123'
          }
        ]
      });
    });

    it('should handle missing work or grant IDs', () => {
      const mockProfiles = [
        {
          expertId: '123',
          fullName: 'John Doe',
          works: [
            {
              // Missing ID
              title: 'Research Paper 1'
            }
          ],
          grants: [
            {
              // Missing ID
              title: 'Grant Project 1'
            }
          ]
        }
      ];

      const result = formatExpertProfilesToFeatures(mockProfiles);

      // Works and grants without IDs should be filtered out
      expect(result.works).toHaveLength(0);
      expect(result.grants).toHaveLength(0);
    });

    it('should merge related experts for duplicate works or grants', () => {
      const mockProfiles = [
        {
          expertId: '123',
          fullName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          url: 'https://experts.ucdavis.edu/expert/123',
          works: [
            {
              id: 'w1',
              title: 'Shared Research'
            }
          ],
          grants: []
        },
        {
          expertId: '456',
          fullName: 'Jane Smith',
          firstName: 'Jane',
          lastName: 'Smith',
          url: 'https://experts.ucdavis.edu/expert/456',
          works: [
            {
              id: 'w1',
              title: 'Shared Research'
            }
          ],
          grants: []
        }
      ];

      const result = formatExpertProfilesToFeatures(mockProfiles);

      // Should have one work with two related experts
      expect(result.works).toHaveLength(1);
      expect(result.works[0].relatedExperts).toHaveLength(2);
      expect(result.works[0].relatedExperts[0].fullName).toBe('John Doe');
      expect(result.works[0].relatedExperts[1].fullName).toBe('Jane Smith');
    });
  });
});
