"use client";

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUpload, FiCheckCircle } from 'react-icons/fi';

interface FileUploadProps {
  accept: Record<string, string[]>;
  onFileSelect: (file: File) => void;
  fileType: 'video' | 'graph';
  selectedFile: File | null;
}

export default function FileUpload({ 
  accept, 
  onFileSelect, 
  fileType, 
  selectedFile 
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const fileTypeText = fileType === 'video' ? 'video ad' : 'dropout graph';

  return (
    <div className="mb-4 sm:mb-6">
      <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
        {fileType === 'video' ? 'Upload Video Ad' : 'Upload Dropout Graph'}
      </label>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 sm:p-6 cursor-pointer transition-colors touch-manipulation min-h-[120px] sm:min-h-[140px] ${
          isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : selectedFile 
              ? 'border-green-400 bg-green-50' 
              : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-gray-500 h-full">
          {selectedFile ? (
            <div className="flex flex-col items-center text-center">
              <FiCheckCircle className="text-green-500 text-2xl sm:text-3xl mb-2" />
              <p className="text-xs sm:text-sm font-medium text-green-700">File selected</p>
              <p className="text-xs text-gray-500 mt-1 px-2 max-w-full break-words">
                {selectedFile.name}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <FiUpload className="text-gray-400 text-2xl sm:text-3xl mb-2" />
              <p className="text-xs sm:text-sm px-2">
                Drag & drop your {fileTypeText} here, or <span className="text-blue-500 font-medium">browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-1 px-2">
                {fileType === 'video' ? 'Supported: MP4, WebM, MOV' : 'Supported: PNG, JPG, JPEG, PDF'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 