"use client";

import { useState } from 'react';
import FileUpload from './FileUpload';
import ProgressBar from './ProgressBar';
import { FiPlus, FiTrash2, FiUpload, FiCheck } from 'react-icons/fi';
import { FilePair } from '@/types';

interface AdUploadFormProps {
  sessionId: string;
  onUploadComplete?: () => void;
}

export default function AdUploadForm({ sessionId, onUploadComplete }: AdUploadFormProps) {
  const [filePairs, setFilePairs] = useState<FilePair[]>([
    {
      id: Date.now().toString(),
      video: null,
      graph: null,
      uploading: false,
      progress: 0,
      uploaded: false,
      error: null,
    },
  ]);

  const handleFileSelect = (pairId: string, fileType: 'video' | 'graph', file: File) => {
    setFilePairs((prev) =>
      prev.map((pair) =>
        pair.id === pairId
          ? {
              ...pair,
              [fileType]: file,
              error: null,
            }
          : pair
      )
    );
  };

  const addNewPair = () => {
    setFilePairs((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        video: null,
        graph: null,
        uploading: false,
        progress: 0,
        uploaded: false,
        error: null,
      },
    ]);
  };

  const removePair = (pairId: string) => {
    setFilePairs((prev) => prev.filter((pair) => pair.id !== pairId));
  };

  const uploadFilePair = async (pair: FilePair) => {
    if (!pair.video || !pair.graph) {
      setFilePairs((prev) =>
        prev.map((p) =>
          p.id === pair.id
            ? {
                ...p,
                error: 'Both video and graph files are required',
              }
            : p
        )
      );
      return;
    }

    setFilePairs((prev) =>
      prev.map((p) =>
        p.id === pair.id
          ? {
              ...p,
              uploading: true,
              progress: 0,
              error: null,
            }
          : p
      )
    );

    try {
      const formData = new FormData();
      formData.append('video', pair.video);
      formData.append('graph', pair.graph);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      setFilePairs((prev) =>
        prev.map((p) =>
          p.id === pair.id
            ? {
                ...p,
                uploading: false,
                progress: 100,
                uploaded: true,
                error: null,
              }
            : p
        )
      );

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      setFilePairs((prev) =>
        prev.map((p) =>
          p.id === pair.id
            ? {
                ...p,
                uploading: false,
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : p
        )
      );
    }
  };

  const uploadAll = async () => {
    const incompleteFiles = filePairs.some(
      (pair) => !pair.video || !pair.graph
    );

    if (incompleteFiles) {
      alert('Please select both video and graph files for each pair');
      return;
    }

    // Upload each pair sequentially
    for (const pair of filePairs) {
      if (!pair.uploaded && !pair.uploading) {
        await uploadFilePair(pair);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        {filePairs.map((pair, index) => (
          <div
            key={pair.id}
            className="border rounded-lg p-6 mb-4 bg-white shadow-sm"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Pair #{index + 1}</h3>
              {filePairs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePair(pair.id)}
                  className="text-red-600 hover:text-red-800"
                  disabled={pair.uploading}
                >
                  <FiTrash2 className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUpload
                accept={{
                  'video/*': ['.mp4', '.webm', '.mov'],
                }}
                onFileSelect={(file) => handleFileSelect(pair.id, 'video', file)}
                fileType="video"
                selectedFile={pair.video}
              />

              <FileUpload
                accept={{
                  'image/*': ['.png', '.jpg', '.jpeg'],
                  'application/pdf': ['.pdf'],
                }}
                onFileSelect={(file) => handleFileSelect(pair.id, 'graph', file)}
                fileType="graph"
                selectedFile={pair.graph}
              />
            </div>

            {pair.error && (
              <div className="mt-2 text-red-600 text-sm">{pair.error}</div>
            )}

            {pair.uploading && (
              <div className="mt-4">
                <ProgressBar
                  progress={pair.progress}
                  label="Uploading files..."
                />
              </div>
            )}

            {pair.uploaded && (
              <div className="mt-4 flex items-center text-green-600">
                <FiCheck className="mr-2" />
                <span>Successfully uploaded!</span>
              </div>
            )}

            {!pair.uploading && !pair.uploaded && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => uploadFilePair(pair)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  disabled={!pair.video || !pair.graph}
                >
                  <FiUpload className="mr-2" />
                  Upload This Pair
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={addNewPair}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FiPlus className="mr-2" />
          Add Another Pair
        </button>

        <button
          type="button"
          onClick={uploadAll}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          <FiUpload className="mr-2" />
          Upload All Pairs
        </button>
      </div>
    </div>
  );
} 