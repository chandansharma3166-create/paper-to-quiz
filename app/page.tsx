"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

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

    const questionRegex = /^(\bQ?\d+[\.\)]|\bQuestion\s*\d*[:\.\)]?)\s+/i;
    const optionTokenRegex = /(\([1-4A-Da-d]\)|\[[1-4A-Da-d]\]|\b[1-4A-Da-d][\.\)])\s+/g;

    lines.forEach((line) => {
      if (questionRegex.test(line)) {
        if (currentQuestion) questions.push(currentQuestion);
        currentQuestion = { question: line, options: [] };
        return;
      }

      const matches = [...line.matchAll(optionTokenRegex)];

      if (matches.length > 0) {
        if (!currentQuestion) {
          currentQuestion = { question: "Extracted Question", options: [] };
        }

        matches.forEach((match, idx) => {
          const startIndex = match.index!;
          const endIndex =
            idx + 1 < matches.length ? matches[idx + 1].index! : line.length;
          const optText = line.substring(startIndex, endIndex).trim();
          if (optText) {
            currentQuestion?.options.push(optText);
          }
        });
      } else if (currentQuestion) {
        if (line.length <= 2 && /^[PpvV\-_\|]+$/.test(line)) {
          return;
        }

        if (currentQuestion.options.length === 0) {
          currentQuestion.question += " " + line;
        }
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
      alert("Failed to read image. Please try again.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  // Export to Microsoft Word (.docx)
  const exportToWord = async () => {
    if (parsedQuestions.length === 0) return;

    const docChildren: Paragraph[] = [
      new Paragraph({
        text: "Extracted Quiz Questions",
        heading: HeadingLevel.TITLE,
        spacing: { after: 300 },
      }),
    ];

    parsedQuestions.forEach((item, index) => {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${item.question.replace(/^\d+[\.\)]\s*/, "")}`,
              bold: true,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      item.options.forEach((opt) => {
        docChildren.push(
          new Paragraph({
            text: opt,
            indent: { left: 720 },
            spacing: { after: 50 },
          })
        );
      });
    });

    const doc = new Document({
      sections: [{ children: docChildren }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "quiz-questions.docx");
  };

  // Export to PDF (.pdf)
  const exportToPDF = () => {
    if (parsedQuestions.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    let y = 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Extracted Quiz Questions", margin, y);
    y += 10;

    parsedQuestions.forEach((item, index) => {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const cleanQ = `${index + 1}. ${item.question.replace(/^\d+[\.\)]\s*/, "")}`;
      const splitTitle = doc.splitTextToSize(cleanQ, maxLineWidth);
      doc.text(splitTitle, margin, y);
      y += splitTitle.length * 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      item.options.forEach((opt) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        const splitOpt = doc.splitTextToSize(opt, maxLineWidth - 10);
        doc.text(splitOpt, margin + 5, y);
        y += splitOpt.length * 5;
      });

      y += 4;
    });

    doc.save("quiz-questions.pdf");
  };

  return (
    <main className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight sm:text-4xl">
            Paper Question Extractor
          </h1>
          <p className="text-zinc-600">
            Upload question paper photos to extract questions and export them directly to Word or PDF.
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

        {/* Display Parsed Questions & Export Actions */}
        {parsedQuestions.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-zinc-800">
                Extracted Results ({parsedQuestions.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={exportToWord}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Download Word (.docx)
                </button>
                <button
                  onClick={exportToPDF}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Download PDF (.pdf)
                </button>
              </div>
            </div>

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