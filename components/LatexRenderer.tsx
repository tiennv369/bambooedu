import React, { useMemo, useEffect, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';

interface LatexRendererProps {
  text: string;
  className?: string;
}

const LatexRenderer: React.FC<LatexRendererProps> = memo(({ text, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- ADVANCED LATEX PROCESSING ---
  const contentParts = useMemo(() => {
      if (!text || typeof text !== 'string') return [];

      let cleanText = text.trim();

      // 1. Global Sanitize: Fix common Word/Copy-paste formatting issues
      cleanText = cleanText
          .replace(/[\u2013\u2014]/g, "-") 
          .replace(/[\u201C\u201D]/g, '"') 
          .replace(/[\u2018\u2019]/g, "'")
          // Fix space between \left and brace: "\left {" -> "\left\{"
          .replace(/\\left\s+([\[\(\{\|.\{])/g, '\\left$1')
          .replace(/\\right\s+([\]\)\}\|.\}])/g, '\\right$1');

      // 2. TOKENIZATION: Split by EXISTING math delimiters first.
      // This protects existing formulas (e.g. $f(x)$) from being double-wrapped (becoming $$f(x)$$).
      // Regex captures: $$...$$, $...$, \[...\], \(...\)
      const segments = cleanText.split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[\s\S]*?(?<!\\)\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g);

      // 3. Process ONLY text segments
      const processedSegments = segments.map(segment => {
          // If segment looks like existing math, return it exactly as is
          if (/^(\$\$|\$|\\\[|\\\()/.test(segment)) {
              return segment;
          }

          // --- SMART WRAP LOGIC FOR TEXT SEGMENTS ---
          let processed = segment;

          // A. Check for "Heavy" Math commands that imply a complex formula (Set notation, Fractions, Integrals)
          // If we find these, we assume the user forgot delimiters for the whole block or it's an Option field.
          const hasHeavyMath = /\\(frac|sqrt|sum|int|lim|begin|cases|left|right|ce|vec|overrightarrow)/.test(processed);
          
          if (hasHeavyMath) {
             // If it contains heavy math, wrap the ENTIRE segment in $.
             // This fixes cases like: "S = { \frac{\pi}{4} ... }" becoming "$S = { \frac{\pi}{4} ... }$"
             // Exception: If it looks like a very long paragraph (>150 chars), we might risk wrapping text, 
             // but for exam questions, this heuristic is usually correct.
             return `$${processed}$`;
          }

          // B. Granular wrapping for simple symbols (Greek letters, f(x), basic sets)
          // Only apply this if we didn't do the heavy wrap above.
          
          // 1. Wrap sets \mathbb{R}, \mathcal{O}, \vec{u}
          processed = processed.replace(
              /(?<!\$|\\)(\\(?:mathbb|mathcal|vec|overrightarrow)\s*\{[a-zA-Z0-9]+\})(?!\$)/g,
              (match) => ` $${match}$ `
          );

          // 2. Wrap isolated Greek letters and Logic symbols
          // Note: We use a replacement function to prevent "$$1$" bugs
          processed = processed.replace(
              /(?<!\$|\\|\{)(\\(?:alpha|beta|gamma|delta|pi|theta|sigma|omega|infty|in|notin|forall|exists|leq|geq|neq|pm|cap|cup|subset|supset|approx)\b)(?!\$)/g,
              (match) => ` $${match}$ `
          );

          // 3. Wrap function notation f(x), g(x) - cautiously
          processed = processed.replace(
              /(?<!\$|\\|\w)\b([fghy]\s*\([a-z0-9]+\))(?!\$)/g,
              (match, g1) => ` $${g1}$ `
          );

          // 4. Wrap chemical formulas \ce{...}
          processed = processed.replace(
              /(?<!\$|\\)\s*(\\ce\{[\s\S]*?\})\s*(?!\$)/g, 
              (match) => ` $${match}$ `
          );

          return processed;
      });

      // 4. Re-join and Split for Rendering
      // We join everything back, then split again using the standard logic for React rendering
      const finalString = processedSegments.join('');
      
      return finalString.split(
          /(\$\$[\s\S]*?\$\$|(?<!\\)\$[\s\S]*?(?<!\\)\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g
      );

  }, [text]);

  // --- TRIGGER MATHJAX RENDER ---
  useEffect(() => {
      const frameId = requestAnimationFrame(() => {
          if (typeof window !== 'undefined' && (window as any).MathJax && containerRef.current) {
              try {
                  (window as any).MathJax.typesetPromise([containerRef.current])
                      .catch((err: any) => {
                         // console.debug('MathJax processing:', err);
                      });
              } catch (e) {
                  if ((window as any).MathJax.Hub) {
                       (window as any).MathJax.Hub.Queue(["Typeset", (window as any).MathJax.Hub, containerRef.current]);
                  }
              }
          }
      });
      return () => cancelAnimationFrame(frameId);
  }, [contentParts]); 

  const renderMathBlock = (mathText: string, index: number) => {
      return <span key={index} dangerouslySetInnerHTML={{ __html: mathText }} className="math-inline mx-1" />;
  };

  return (
    <div ref={containerRef} className={`markdown-content text-gray-800 ${className || ''}`} style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '1.2rem', lineHeight: '1.6' }}>
      {contentParts.map((part, index) => {
        if (
            part.startsWith('$$') || 
            part.startsWith('$') || 
            part.startsWith('\\(') || 
            part.startsWith('\\[')
        ) {
            return renderMathBlock(part, index);
        } else {
            return (
                <ReactMarkdown 
                    key={index} 
                    components={{
                        p: ({node, ...props}) => <span {...props} className="inline" />,
                        strong: ({node, ...props}) => <strong {...props} className="font-bold text-gray-900" />,
                    }}
                >
                    {part}
                </ReactMarkdown>
            );
        }
      })}
    </div>
  );
});

export default LatexRenderer;