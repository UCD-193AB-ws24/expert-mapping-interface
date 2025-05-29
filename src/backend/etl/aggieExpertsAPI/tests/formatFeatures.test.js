const { formatFeatures } = require('../services/formatFeatures');

describe('formatFeatures', () => {
  it('should format works and grants with related experts', () => {
    const input = [
      {
        expertId: '1',
        firstName: 'Alice',
        lastName: 'Smith',
        fullName: 'Alice Smith',
        title: 'Professor',
        organizationUnit: 'Math',
        url: 'http://example.com/alice',
        works: [
          { id: 'w1', title: 'Paper 1', issued: ['2020'] },
          { id: 'w2', title: 'Paper 2', issued: ['2021'] }
        ],
        grants: [
          { id: 'g1', title: 'Grant 1', issued: ['2019'] }
        ]
      },
      {
        expertId: '2',
        firstName: 'Bob',
        lastName: 'Jones',
        fullName: 'Bob Jones',
        title: 'Researcher',
        organizationUnit: 'Physics',
        url: 'http://example.com/bob',
        works: [
          { id: 'w1', title: 'Paper 1', issued: ['2020'] }
        ],
        grants: [
          { id: 'g1', title: 'Grant 1', issued: ['2019'] },
          { id: 'g2', title: 'Grant 2', issued: ['2022'] }
        ]
      }
    ];

    const result = formatFeatures(input);

    // Works
    expect(result.works).toHaveLength(2);
    const work1 = result.works.find(w => w.id === 'w1');
    expect(work1.relatedExperts).toHaveLength(2);
    expect(work1.issued).toBe('2020');
    const work2 = result.works.find(w => w.id === 'w2');
    expect(work2.relatedExperts).toHaveLength(1);
    expect(work2.relatedExperts[0].firstName).toBe('Alice');

    // Grants
    expect(result.grants).toHaveLength(2);
    const grant1 = result.grants.find(g => g.id === 'g1');
    expect(grant1.relatedExperts).toHaveLength(2);
    expect(grant1.issued).toBe('2019');
    const grant2 = result.grants.find(g => g.id === 'g2');
    expect(grant2.relatedExperts).toHaveLength(1);
    expect(grant2.relatedExperts[0].firstName).toBe('Bob');
  });

  it('should handle missing works and grants gracefully', () => {
    const input = [
      {
        expertId: '3',
        firstName: 'Charlie',
        lastName: 'Brown',
        fullName: 'Charlie Brown',
        title: 'Lecturer',
        organizationUnit: 'Chemistry',
        url: 'http://example.com/charlie'
        // No works or grants
      }
    ];
    const result = formatFeatures(input);
    expect(result.works).toHaveLength(0);
    expect(result.grants).toHaveLength(0);
  });

  it('should skip works and grants without id', () => {
    const input = [
      {
        expertId: '4',
        firstName: 'Dana',
        lastName: 'White',
        fullName: 'Dana White',
        title: 'Assistant Professor',
        organizationUnit: 'Biology',
        url: 'http://example.com/dana',
        works: [
          { title: 'No ID Work', issued: ['2023'] }
        ],
        grants: [
          { title: 'No ID Grant', issued: ['2024'] }
        ]
      }
    ];
    const result = formatFeatures(input);
    expect(result.works).toHaveLength(0);
    expect(result.grants).toHaveLength(0);
  });
});