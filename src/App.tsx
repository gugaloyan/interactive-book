import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set PDF.js worker URL
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs`;

type Role = "reader" | "viewer";

const App = () => {
  const [pageText, setPageText] = useState<string>("");
  const [role, setRole] = useState<Role>("viewer");
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [pdfText, setPdfText] = useState<Record<number, string>>({});
  const flipBookRef = useRef<any>(null);

  // When the PDF loads successfully
  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages);
    setPdfFile(pdf);
    setCurrentPage(0); // Go to first page
  };

  // Fetch and cache text content for a specific page
  const fetchPageText = async (pageIndex: number) => {
    if (!pdfFile) return;
    try {
      const page = await pdfFile.getPage(pageIndex + 1); // PDF pages are 1-based
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      const text = strings.join(" ");
      setPdfText((prev) => ({ ...prev, [pageIndex]: text }));
    } catch (error) {
      console.error("Error fetching page text:", error);
    }
  };

  // Fetch missing page text when currentPage changes
  useEffect(() => {
    if (
      pdfFile &&
      currentPage >= 0 &&
      currentPage < numPages &&
      !pdfText[currentPage]
    ) {
      fetchPageText(currentPage);
    }
  }, [currentPage, pdfFile, pdfText, numPages,]);




  useEffect(() => {
    if (pdfText[currentPage]) {
      setPageText(pdfText[currentPage]);
    }
  }, [currentPage, pdfText]);


  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const toggleRole = () => {
    setRole((prev) => (prev === "viewer" ? "reader" : "viewer"));
  };

  const flipPrev = () => {
    if (flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipPrev();
      window.speechSynthesis.cancel()
    }
  };

  const flipNext = () => {
    if (flipBookRef.current?.pageFlip) {
      flipBookRef.current.pageFlip().flipNext();
      window.speechSynthesis.cancel()
    }
  };

  const isReader = role === "reader";

  return (
    <div className="App">
      <h1>📖 Interactive Book</h1>

      <button
        onClick={toggleRole}
        style={{
          position: "fixed",
          top: 10,
          right: 10,
          zIndex: 999,
          padding: "8px 12px",
        }}
      >
        Role: {role}
      </button>

      <Document
        file="/book.pdf"
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<p>Loading PDF...</p>}
        error={<p>Failed to load PDF</p>}
      >
        <HTMLFlipBook
          key={role}
          width={400}
          height={600}
          ref={flipBookRef}
          className="flip-book"
          size="fixed"
          startPage={0}
          minWidth={315}
          maxWidth={1000}
          minHeight={400}
          maxHeight={1536}
          drawShadow={true}
          flippingTime={1000}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          clickEventForward={true}
          useMouseEvents={isReader}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={role !== "reader"}
          style={{ margin: "0 auto" }}
          maxShadowOpacity={0.5}
          showCover={false}
          mobileScrollSupport={true}
          onFlip={(e) => {
            const page = Number(e.data);
            if (!isNaN(page)) {
              setCurrentPage(page);
              setPageText(""); // Clear old text while loading
            }
            window.speechSynthesis.cancel()
          }}
        >
          {Array.from(new Array(numPages), (_, i) => (
            <div key={i} className="page">
              <Page
                pageNumber={i + 1}
                width={380}
                loading={<p>Loading page {i + 1}...</p>}
              />
            </div>
          ))}
        </HTMLFlipBook>
      </Document>

      {role === "reader" && (
        <div className="controls">
          <button onClick={flipPrev}>⬅ Prev</button>
          <button onClick={flipNext}>Next ➡</button>
          <button
            onClick={() =>
              speakText(
                pageText.trim()
                  ? pageText
                  : `Page ${currentPage + 1 || 1} content is loading...`
              )
            }
            disabled={!pageText.trim()}
          >
            🔊 Read Page {currentPage + 1 || 1}
          </button>
          <button onClick={() => window.speechSynthesis.cancel()}>
            ⏹ Stop Reading
          </button>
        </div>
      )}

    </div>
  );
};

export default App;
