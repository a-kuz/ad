import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface LogFile {
  name: string;
  path: string;
  createdAt: string;
  size: number;
}

interface LlmLogsViewProps {
  filePairId: string;
}

export default function LlmLogsView({ filePairId }: LlmLogsViewProps) {
  const [logs, setLogs] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        setLoading(true);
        const response = await fetch(`/api/analysis-logs/${filePairId}/llm`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch LLM logs');
        }
        
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error fetching LLM logs');
      } finally {
        setLoading(false);
      }
    }

    if (filePairId) {
      fetchLogs();
    }
  }, [filePairId]);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  if (loading) {
    return <div className="p-4">Loading LLM logs...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (logs.length === 0) {
    return <div className="p-4">No LLM logs found for this analysis.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">LLM Logs</h2>
      <div className="bg-gray-100 rounded-lg p-4">
        <ul className="divide-y divide-gray-300">
          {logs.map((log) => (
            <li key={log.name} className="py-3">
              <Link 
                href={log.path} 
                target="_blank" 
                className="flex items-center justify-between hover:bg-gray-200 p-2 rounded"
              >
                <div>
                  <div className="font-medium">{log.name}</div>
                  <div className="text-sm text-gray-600">Created: {formatDate(log.createdAt)}</div>
                </div>
                <div className="text-sm text-gray-500">{formatFileSize(log.size)}</div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 