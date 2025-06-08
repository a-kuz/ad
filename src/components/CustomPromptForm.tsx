import React, { useState, useEffect } from 'react';
import { AnalysisPrompt } from '@/lib/database';

interface CustomPromptFormProps {
  filePairId: string;
  sessionId: string;
  type: string;
  onAnalysisUpdate: (newAnalysis: any) => void;
  defaultPrompt?: string;
  isDisabled?: boolean;
}

const AI_MODELS = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4.1-mini", label: "GPT-4o Mini" },
  { value: "o3", label: "Claude 3 Opus (o3)" }
];

const DEFAULT_VISUAL_PROMPT = `Analyze this screenshot and describe what's happening. Return a JSON object with this structure:
{
  "description": "Brief description of what's happening in the video",
  "actions": ["action1", "action2"],
  "elements": ["element1", "element2"]
}

Focus on:
- Actions: What is happening (e.g., "person speaking", "demonstration", "transition")
- Elements: Visual elements present (e.g., "person", "product", "text overlay", "background")

Keep descriptions concise and factual.`;

export default function CustomPromptForm({ 
  filePairId,
  sessionId,
  type,
  onAnalysisUpdate,
  defaultPrompt,
  isDisabled = false
}: CustomPromptFormProps) {
  const [prompt, setPrompt] = useState<string>(defaultPrompt || DEFAULT_VISUAL_PROMPT);
  const [model, setModel] = useState<string>("gpt-4.1-mini");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPrompt, setSavedPrompt] = useState<AnalysisPrompt | null>(null);

  // Fetch existing prompt for this file pair and type
  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        console.log(`Fetching prompt for filePairId=${filePairId}, type=${type}`);
        const response = await fetch(`/api/analysis-prompts/${filePairId}?type=${type}`);
        console.log('Prompt fetch response:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Prompt data:', data);
          if (data.prompt) {
            setSavedPrompt(data.prompt);
            setPrompt(data.prompt.prompt);
            setModel(data.prompt.model);
          }
        } else {
          const errorData = await response.json().catch(() => null);
          console.error('Error fetching prompt:', errorData || 'Unknown error');
        }
      } catch (error) {
        console.error('Failed to fetch saved prompt:', error);
      }
    };

    if (filePairId && type) {
      fetchPrompt();
    }
  }, [filePairId, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let endpoint = '';
      if (type === 'visual') {
        endpoint = '/api/regenerate-visual-analysis';
      } else {
        setError('Unsupported analysis type');
        setIsSubmitting(false);
        return;
      }

      console.log(`Submitting custom prompt for ${type} analysis to ${endpoint}`);
      console.log(`Parameters: sessionId=${sessionId}, filePairId=${filePairId}, model=${model}`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          filePairId,
          customPrompt: prompt,
          model
        }),
      });

      console.log('Regenerate response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Regenerate error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to regenerate analysis');
      }

      const result = await response.json();
      console.log('Analysis regenerated successfully');
      onAnalysisUpdate(result.analysis);
    } catch (error: any) {
      console.error('Error in form submission:', error);
      setError(error.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow border">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 flex items-center">
        <span className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></span>
        Настройки анализа {type === 'visual' ? 'визуального ряда' : type}
      </h3>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
            Модель AI
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isDisabled || isSubmitting}
          >
            {AI_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
            Промпт для анализа
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Введите промпт для анализа..."
            disabled={isDisabled || isSubmitting}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          className={`w-full py-2 px-4 rounded-md ${
            isSubmitting || isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } transition-colors font-medium`}
          disabled={isSubmitting || isDisabled}
        >
          {isSubmitting ? 'Обработка...' : 'Перегенерировать анализ'}
        </button>
        
        {savedPrompt && (
          <p className="mt-2 text-xs text-gray-500">
            Последнее обновление: {new Date(savedPrompt.createdAt).toLocaleString()}
          </p>
        )}
      </form>
    </div>
  );
} 