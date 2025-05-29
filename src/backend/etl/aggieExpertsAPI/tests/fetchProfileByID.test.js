const { getExpertData } = require('../services/fetchProfileByID');
const { postRequestApi } = require('../utils/fetchingUtils');

// Mock the fetchingUtils module
jest.mock('../utils/fetchingUtils', () => ({
  postRequestApi: jest.fn()
}));

describe('fetchProfileByID.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getExpertData', () => {
    it('should throw an error if expertId is not provided', async () => {
      await expect(getExpertData()).rejects.toThrow('Expert ID required');
    });

    it('should fetch and format expert data with works and grants', async () => {
      // Mock data returned from API
      const mockApiResponse = {
        '@type': 'Person',
        '@id': 'https://experts.ucdavis.edu/expert/12345',
        'modified-date': '2023-01-01',
        'contactInfo': {
          'hasName': {
            'given': 'John',
            'middle': 'A',
            'family': 'Doe'
          },
          'hasTitle': {
            'name': 'Professor'
          },
          'hasOrganizationalUnit': {
            'name': 'Computer Science'
          }
        },
        '@graph': [
          {
            '@type': ['ScholarlyArticle'],
            'title': 'Test Article',
            'abstract': 'This is a test abstract',
            'issued': '2022',
            'author': [{ 'given': 'John', 'family': 'Doe' }],
            '@id': 'https://experts.ucdavis.edu/work/101'
          },
          {
            '@type': ['Grant'],
            '@id': 'https://experts.ucdavis.edu/grant/201',
            'name': 'Test Grant',
            'assignedBy': { 'name': 'Test Funder' },
            'status': 'Active',
            'dateTimeInterval': {
              'start': { 'dateTime': '2022-01-01' },
              'end': { 'dateTime': '2023-12-31' }
            },
            'relatedBy': [{ '@type': 'PrincipalInvestigator' }]
          }
        ]
      };

      postRequestApi.mockResolvedValueOnce(mockApiResponse);

      const result = await getExpertData('12345', 1, 1);

      // Check API call
      expect(postRequestApi).toHaveBeenCalledWith(
        'https://experts.ucdavis.edu/api/expert/12345',
        expect.any(Object),
        null
      );

      // Check result format
      expect(result).toEqual({
        expertId: '12345',
        type: 'Person',
        firstName: 'John',
        middleName: 'A',
        lastName: 'Doe',
        fullName: 'John A Doe',
        title: 'Professor',
        organizationUnit: 'Computer Science',
        lastModified: '2023-01-01',
        url: 'https://experts.ucdavis.edu/expert/12345',
        works: [
          expect.objectContaining({
            title: 'Test Article',
            abstract: 'This is a test abstract',
            issued: '2022',
            id: '101'
          })
        ],
        grants: [
          expect.objectContaining({
            title: 'Test Grant',
            funder: 'Test Funder',
            startDate: '2022-01-01',
            endDate: '2023-12-31',
            id: '201'
          })
        ]
      });
    });

    it('should handle API errors gracefully', async () => {
      postRequestApi.mockRejectedValueOnce(new Error('API error'));
      await expect(getExpertData('12345')).rejects.toThrow('API error');
    });
  });
});
