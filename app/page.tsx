"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";

interface ParsedQuestion {
  question: string;
  options: string[];
}

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      setParsedQuestions([]);
    }
  };

  const parseQuestionsAndOptions = (text: string) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const questions: ParsedQuestion[] = [];
    let currentQuestion: ParsedQuestion | null = null;

    lines.forEach((line) => {
      // Matches question starters: 1., Q1., Question 1, etc.
      if (/^(Q?\d+[\.\)]|\bQuestion\s*\d*[:\.\)]?)/i.test(line)) {
        if (currentQuestion) questions.push(currentQuestion);
        currentQuestion = { question: line, options: [] };
      }
      // Matches options starters: (A), A., A), [A], 1., etc.
      else if (/^(\([A-Da-d\d]\)|[A-Da-d][\.\)]|\[[A-Da-d]\])/.test(line)) {
        if (currentQuestion) {
          currentQuestion.options.push(line);
        }
      } 
      // If continuing question description before options start
      else if (currentQuestion && currentQuestion.options.length === 0) {
        currentQuestion.question += " " + line;
      }
    });

    if (currentQuestion) questions.push(currentQuestion);
    setParsedQuestions(questions);
  };

  const processImage = async () => {
    if (!image) return;
    setLoading(true);
    setProgress("Initializing OCR engine...");

    try {
      const worker = await createWorker("eng");
      
      setProgress("Reading image text...");
      const {
        data: { text },
      } = await worker.recognize(image);
      await worker.terminate();

      setProgress("Organizing questions...");
      parseQuestionsAndOptions(text);
    } catch (err) {
      console.error("OCR Extraction failed:", err);
      alert("Failed to read image. Please try again with a clearer image.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight sm:text-4xl">
            Paper Question Extractor
          </h1>
          <p className="text-zinc-600">
            Upload an image of a question paper to convert it into text and options.
          </p>
        </header>

        {/* Upload Box */}
        <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col items-center justify-center border-dashed">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="block w-full max-w-sm text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-zinc-900 file:text-white hover:file:bg-zinc-800 cursor-pointer"
          />
        </section>

        {/* Image Preview & Extract Action */}
        {image && (
          <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <img
              src={image}
              alt="Uploaded Question Paper"
              className="max-h-72 rounded-lg object-contain border border-zinc-100 shadow-sm"
            />
            <button
              onClick={processImage}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium transition"
            >
              {loading ? progress || "Processing..." : "Extract Questions & Options"}
            </button>
          </div>
        )}

        {/* Display Parsed Questions */}
        {parsedQuestions.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-zinc-800">
              Extracted Results ({parsedQuestions.length})
            </h2>
            <div className="space-y-4">
              {parsedQuestions.map((item, index) => (
                <div
                  key={index}
                  className="p-5 bg-white border border-zinc-200 rounded-xl shadow-sm space-y-3"
                >
                  <p className="font-medium text-zinc-900">{item.question}</p>
                  {item.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                      {item.options.map((opt, optIndex) => (
                        <div
                          key={optIndex}
                          className="bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-lg text-sm text-zinc-700"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}