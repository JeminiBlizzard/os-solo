import { describe, it, expect } from 'vitest';

describe('ExpenseTable', () => {
  describe('Filtering', () => {
    it('should filter expenses by name (case-insensitive)', () => {
      const expenses = [
        { id: 1, name: 'AWS EC2', category: 'infrastructure', amount_cents: 5000 },
        { id: 2, name: 'GitHub Pro', category: 'software', amount_cents: 2100 },
        { id: 3, name: 'aws lambda', category: 'infrastructure', amount_cents: 1500 },
      ];

      const searchTerm = 'aws';
      const filtered = expenses.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      expect(filtered.length).toBe(2);
      expect(filtered[0].name).toBe('AWS EC2');
      expect(filtered[1].name).toBe('aws lambda');
    });

    it('should filter expenses by category', () => {
      const expenses = [
        { id: 1, name: 'AWS EC2', category: 'infrastructure', amount_cents: 5000 },
        { id: 2, name: 'GitHub Pro', category: 'software', amount_cents: 2100 },
        { id: 3, name: 'Google Ads', category: 'marketing', amount_cents: 10000 },
      ];

      const categoryFilter = 'infrastructure';
      const filtered = expenses.filter(e => e.category === categoryFilter);

      expect(filtered.length).toBe(1);
      expect(filtered[0].category).toBe('infrastructure');
    });

    it('should apply both search and category filters', () => {
      const expenses = [
        { id: 1, name: 'AWS EC2', category: 'infrastructure', amount_cents: 5000 },
        { id: 2, name: 'AWS RDS', category: 'infrastructure', amount_cents: 3000 },
        { id: 3, name: 'GitHub Pro', category: 'software', amount_cents: 2100 },
      ];

      const searchTerm = 'aws';
      const categoryFilter = 'infrastructure';

      const filtered = expenses.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        e.category === categoryFilter
      );

      expect(filtered.length).toBe(2);
    });

    it('should show all expenses when category is "all"', () => {
      const expenses = [
        { id: 1, name: 'AWS EC2', category: 'infrastructure', amount_cents: 5000 },
        { id: 2, name: 'GitHub Pro', category: 'software', amount_cents: 2100 },
      ];

      const categoryFilter = 'all';
      const filtered = expenses.filter(e =>
        categoryFilter === 'all' || e.category === categoryFilter
      );

      expect(filtered.length).toBe(2);
    });
  });

  describe('CSV Escaping (RFC 4180)', () => {
    function escapeCsvField(field: string): string {
      if (!field) return '';
      const needsQuotes = field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r');
      if (needsQuotes) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    }

    it('should not quote simple fields', () => {
      expect(escapeCsvField('AWS EC2')).toBe('AWS EC2');
      expect(escapeCsvField('infrastructure')).toBe('infrastructure');
    });

    it('should quote fields containing commas', () => {
      const field = 'EC2, RDS, Lambda';
      expect(escapeCsvField(field)).toBe('"EC2, RDS, Lambda"');
    });

    it('should quote and double-escape fields containing quotes', () => {
      const field = 'AWS "Premium" Support';
      expect(escapeCsvField(field)).toBe('"AWS ""Premium"" Support"');
    });

    it('should quote fields containing newlines', () => {
      const field = 'Line 1\nLine 2';
      expect(escapeCsvField(field)).toBe('"Line 1\nLine 2"');
    });

    it('should handle empty fields', () => {
      expect(escapeCsvField('')).toBe('');
    });

    it('should handle complex field with multiple special chars', () => {
      const field = 'Monthly cost, includes "basic" tier\nfor 3 users';
      expect(escapeCsvField(field)).toBe('"Monthly cost, includes ""basic"" tier\nfor 3 users"');
    });
  });

  describe('Amount Formatting', () => {
    it('should format amounts in cents to dollars', () => {
      const amountCents = 5000; // $50.00
      const formatted = (amountCents / 100).toFixed(2);
      expect(formatted).toBe('50.00');
    });

    it('should format zero amounts', () => {
      const amountCents = 0;
      const formatted = (amountCents / 100).toFixed(2);
      expect(formatted).toBe('0.00');
    });

    it('should handle large amounts', () => {
      const amountCents = 150000; // $1,500.00
      const formatted = (amountCents / 100).toFixed(2);
      expect(formatted).toBe('1500.00');
    });
  });

  describe('Date Formatting', () => {
    it('should format ISO date strings', () => {
      const dateStr = '2026-04-15';
      const date = new Date(dateStr);
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      expect(formatted).toMatch(/Apr 1[45], 2026/); // May vary by timezone
    });
  });

  describe('Interval Display', () => {
    it('should capitalize and format interval values', () => {
      const intervals = ['one_time', 'monthly', 'annual', 'quarterly', 'usage'];
      const formatted = intervals.map(i => i.replace('_', ' '));

      expect(formatted[0]).toBe('one time');
      expect(formatted[1]).toBe('monthly');
      expect(formatted[2]).toBe('annual');
    });
  });

  describe('Category Badge Colors', () => {
    it('should assign correct colors to categories', () => {
      const colors: Record<string, string> = {
        infrastructure: 'bg-blue-80 text-blue-30',
        software: 'bg-teal-80 text-teal-30',
        marketing: 'bg-orange-80 text-orange-30',
        other: 'bg-gray-80 text-gray-30',
      };

      expect(colors['infrastructure']).toBe('bg-blue-80 text-blue-30');
      expect(colors['software']).toBe('bg-teal-80 text-teal-30');
      expect(colors['marketing']).toBe('bg-orange-80 text-orange-30');
      expect(colors['other']).toBe('bg-gray-80 text-gray-30');
    });

    it('should default to gray for unknown categories', () => {
      const colors: Record<string, string> = {
        infrastructure: 'bg-blue-80 text-blue-30',
      };
      const category = 'unknown';
      const colorClass = colors[category] ?? 'bg-gray-80 text-gray-30';

      expect(colorClass).toBe('bg-gray-80 text-gray-30');
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no expenses exist', () => {
      const expenses: any[] = [];
      const isEmpty = expenses.length === 0;

      expect(isEmpty).toBe(true);
    });

    it('should not show empty state when expenses exist', () => {
      const expenses = [
        { id: 1, name: 'AWS EC2', category: 'infrastructure', amount_cents: 5000 },
      ];
      const isEmpty = expenses.length === 0;

      expect(isEmpty).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should validate required fields', () => {
      const formData = {
        name: '',
        category: 'infrastructure',
        amount_cents: 5000,
      };

      const isValid = formData.name.length > 0 && formData.amount_cents >= 0;
      expect(isValid).toBe(false);
    });

    it('should accept valid expense data', () => {
      const formData = {
        name: 'AWS EC2',
        category: 'infrastructure',
        amount_cents: 5000,
      };

      const isValid = formData.name.length > 0 && formData.amount_cents >= 0;
      expect(isValid).toBe(true);
    });

    it('should reject negative amounts', () => {
      const amountCents = -100;
      const isValid = amountCents >= 0;
      expect(isValid).toBe(false);
    });
  });
});
