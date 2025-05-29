import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import { Document, Page, pdfjs } from "react-pdf";
import HTMLFlipBook from "react-pageflip";
import { io } from "socket.io-client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs`;

type Role = "reader" | "viewer";

const socket = io("https://flipbook-backend-1.onrender.com");

const App = () => {
  const [role, setRole] = useState<Role>("viewer");
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [pdfText, setPdfText] = useState<Record<number, string>>({});
  const [pageText, setPageText] = useState<string>("");
  const flipBookRef = useRef<any>(null);
  const isFlipping = useRef(false);
  const roleRef = useRef<Role>("viewer");

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // 💾 Загрузка текущей страницы из localStorage для viewer
  useEffect(() => {
    if (role === "viewer") {
      const savedPage = localStorage.getItem("viewerPage");
      if (savedPage) {
        setCurrentPage(parseInt(savedPage, 10));
      }
    } else {
      setCurrentPage(0); // 🔁 reader всегда с начала
    }
  }, [role]);

  // 📖 Инициализация Flipbook на нужной странице
  const handleBookInit = () => {
    const flipBook = flipBookRef.current?.pageFlip();
    if (flipBook) {
      flipBook.flip(currentPage);
    }
  };

  const onDocumentLoadSuccess = (pdf: any) => {
    setNumPages(pdf.numPages);
    setPdfFile(pdf);
  };

  const fetchPageText = async (pageIndex: number) => {
    if (!pdfFile) return;
    try {
      const page = await pdfFile.getPage(pageIndex + 1);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      const text = strings.join(" ");
      setPdfText((prev) => ({ ...prev, [pageIndex]: text }));
    } catch (error) {
      console.error("Ошибка при извлечении текста:", error);
    }
  };

  useEffect(() => {
    if (pdfFile && currentPage >= 0 && currentPage < numPages && !pdfText[currentPage]) {
      fetchPageText(currentPage);
    }
  }, [currentPage, pdfFile, pdfText, numPages]);

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
    flipBookRef.current?.pageFlip().flipPrev();
    window.speechSynthesis.cancel();
  };

  const flipNext = () => {
    flipBookRef.current?.pageFlip().flipNext();
    window.speechSynthesis.cancel();
  };

  const isReader = role === "reader";

  useEffect(() => {
    const handlePageFlip = (page: number) => {
      console.log("📥 Received flip:", page);
      const flipBook = flipBookRef.current?.pageFlip();
      if (flipBook && flipBook.getCurrentPageIndex() !== page) {
        isFlipping.current = true;
        flipBook.flip(page);
        setCurrentPage(page);
      }
    };

    socket.on("page-flip", handlePageFlip);
    return () => {
      socket.off("page-flip", handlePageFlip);
    };
  }, []);

  return (
    <div className="App">
      <h1>📖 Interactive Book 1</h1>

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
          startZIndex={0}
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
          drawShadow
          flippingTime={1000}
          usePortrait
          autoSize
          clickEventForward
          useMouseEvents={false}
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={!isReader}
          style={{ margin: "0 auto" }}
          maxShadowOpacity={0.5}
          showCover={false}
          mobileScrollSupport
          onInit={handleBookInit}
          onFlip={(e) => {
            const page = Number(e.data);
            if (!isNaN(page)) {
              setCurrentPage(page);
              setPageText("");

              // 💾 Сохраняем только если viewer
              if (role === "viewer") {
                localStorage.setItem("viewerPage", String(page));
              }

              if (role === "reader" && !isFlipping.current) {
                socket.emit("page-flip", page);
                console.log("📤 Emit page flip:", page);
              }

              isFlipping.current = false;
              window.speechSynthesis.cancel();
            }
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

      {isReader && (
        <div className="controls">
          <button onClick={flipPrev}>⬅ Prev</button>
          <button onClick={flipNext}>Next ➡</button>
          <button
            onClick={() =>
              speakText(pageText.trim() || `Page ${currentPage + 1} content is loading...`)
            }
            disabled={!pageText.trim()}
          >
            🔊 Read Page {currentPage + 1}
          </button>
          <button onClick={() => window.speechSynthesis.cancel()}>
            ⏹ Stop Reading
          </button>
          <span className="numPages">
            Pages {numPages}
          </span>
        </div>
      )}
    </div>
  );
};

export default App;
