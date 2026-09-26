"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

interface ParsedQuestion {
  question: string;
  options: string[];
}

export default function QuizExtractor() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  const parseQuestionsAndOptions = (text: string) => {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const questions: ParsedQuestion[] = [];
    let currentQuestion: ParsedQuestion | null = null;

    lines.forEach((line) => {
      // Matches: 1. Question or Q1. Question
      if (/^(Q?\d+[\.\)]|\bQuestion\b)/i.test(line)) {
        if (currentQuestion) questions.push(currentQuestion);
        currentQuestion = { question: line, options: [] };
      } 
      // Matches: A) Option, (B) Option, 1) Option
      else if (/^(\([A-D]\)|[A-D][\.\)])/i.test(line)) {
        if (currentQuestion) {
          currentQuestion.options.push(line);
        }
      } else if (currentQuestion && currentQuestion.options.length === 0) {
        currentQuestion.question += " " + line;
      }
    });

    if (currentQuestion) questions.push(currentQuestion);
    setParsedQuestions(questions);
  };

  const processImage = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();

      setRawText(text);
      parseQuestionsAndOptions(text);
    } catch (err) {
      console.error("OCR Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50">
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload} 
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
        />
      </div>

      {image && (
        <div className="flex flex-col items-center gap-4">
          <img src={image} alt="Paper upload" className="max-h-64 rounded-md shadow" />
          <button
            onClick={processImage}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Reading paper..." : "Extract Questions & Options"}
          </button>
        </div>
      )}

      {parsedQuestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Extracted Questions</h2>
          {parsedQuestions.map((q, idx) => (
            <div key={idx} className="p-4 border rounded-lg bg-white shadow-sm space-y-2">
              <p className="font-semibold text-gray-800">{q.question}</p>
              <ul className="pl-4 space-y-1">
                {q.options.map((opt, oIdx) => (
                  <li key={oIdx} className="text-gray-600">{opt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}