'use client';

import { useMemo } from 'react';
import { Calendar, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyWithSign } from '@/lib/currency-formatter';
import type { JournalEntry, JournalLine } from '@/types';

interface JournalEntryCardProps {
  entry: JournalEntry;
  accounts?: { id: string; path: string }[];
  defaultCurrency?: string;
  variant?: 'full' | 'compact';
}

export function JournalEntryCard({
  entry,
  accounts = [],
  defaultCurrency = 'USD',
  variant = 'full',
}: JournalEntryCardProps) {
  const accountMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a.path]));
  }, [accounts]);

  const getAccountName = (id: string): string => {
    return accountMap.get(id) || 'Unknown';
  };

  if (variant === 'compact') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(entry.date).toLocaleDateString()}
            </div>
            <Badge variant="secondary">{entry.lines?.length || 0} lines</Badge>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{entry.description}</span>
          </div>
          
          {entry.lines && entry.lines.length > 0 ? (
            <div className="space-y-2 bg-muted/30 rounded-lg p-3">
              {entry.lines.slice(0, 3).map((line: JournalLine, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[60%]">
                    {getAccountName(line.account_id)}
                  </span>
                  <span className="font-medium">
                    {formatCurrencyWithSign(line.amount, line.currency || defaultCurrency)}
                  </span>
                </div>
              ))}
              {entry.lines.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{entry.lines.length - 3} more lines
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No line items</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(entry.date).toLocaleDateString()}
            </div>
            <Badge variant="secondary">{entry.lines?.length || 0} lines</Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{entry.description}</span>
        </div>
        
        {entry.lines && entry.lines.length > 0 ? (
          <div className="space-y-2 bg-muted/30 rounded-lg p-3">
            {entry.lines.map((line: JournalLine, index: number) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {getAccountName(line.account_id)}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      line.amount < 0
                        ? 'text-red-600 font-medium'
                        : 'text-green-600 font-medium'
                    }
                  >
                    {formatCurrencyWithSign(
                      line.amount,
                      line.currency || defaultCurrency
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No line items</p>
        )}
      </CardContent>
    </Card>
  );
}
