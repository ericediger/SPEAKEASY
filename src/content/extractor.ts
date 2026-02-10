import { ArticleContent } from '../lib/types'

// Elements to exclude from content extraction
const EXCLUDED_SELECTORS = [
  // Navigation and structure
  'nav', 'header', 'footer', 'aside', 'menu',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '[role="complementary"]', '[role="search"]',

  // Common class patterns
  '.nav', '.navbar', '.navigation', '.menu', '.header', '.footer',
  '.sidebar', '.side-bar', '.widget', '.widgets',
  '.breadcrumb', '.breadcrumbs',

  // Ads and promotions
  '.ad', '.ads', '.advert', '.advertisement', '.advertising',
  '.sponsored', '.promo', '.promotion', '.banner',
  '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',

  // Social and sharing
  '.social', '.social-share', '.share', '.sharing', '.share-buttons',
  '.follow', '.subscribe', '.newsletter', '.signup',

  // Comments and related
  '.comments', '.comment-section', '.disqus', '#disqus_thread',
  '.related', '.related-posts', '.related-articles', '.recommended',
  '.more-stories', '.read-more', '.also-read',

  // Author bio and metadata (outside article)
  '.author-bio', '.author-info', '.about-author',
  '.tags', '.tag-list', '.categories', '.meta',

  // UI elements
  '.popup', '.modal', '.overlay', '.tooltip',
  '.cookie', '.cookies', '.gdpr', '.consent',

  // Technical
  'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
  'form', 'input', 'button', 'select', 'textarea',
  '[aria-hidden="true"]', '[hidden]',
  'figure figcaption', '.caption', '.image-caption',
]

// Extract article content from the current page
export function extractArticle(): ArticleContent {
  const url = window.location.href
  const title = extractTitle()
  const author = extractAuthor()
  const bodyText = extractBodyText()
  const wordCount = countWords(bodyText)

  return {
    title,
    author,
    bodyText,
    wordCount,
    url,
  }
}

// Extract the article title
function extractTitle(): string {
  // Try Open Graph title first
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (ogTitle) return ogTitle.trim()

  // Try article-specific title elements
  const articleTitle = document.querySelector('article h1, .article-title, .post-title, [itemprop="headline"]')
  if (articleTitle?.textContent) return articleTitle.textContent.trim()

  // Fall back to page title
  const h1 = document.querySelector('h1')
  if (h1?.textContent) return h1.textContent.trim()

  return document.title || 'Untitled Article'
}

// Extract the author name
function extractAuthor(): string | undefined {
  // Try meta tags
  const authorMeta = document.querySelector('meta[name="author"]')?.getAttribute('content')
  if (authorMeta) return authorMeta.trim()

  // Try schema.org markup
  const schemaAuthor = document.querySelector('[itemprop="author"]')?.textContent
  if (schemaAuthor) return schemaAuthor.trim()

  // Try common class names
  const authorElement = document.querySelector('.author, .byline, .article-author, [rel="author"]')
  if (authorElement?.textContent) {
    const text = authorElement.textContent.trim()
    // Clean up common prefixes
    return text.replace(/^(by|written by|author:)\s*/i, '')
  }

  return undefined
}

// Extract the main body text
function extractBodyText(): string {
  // Clone the document to avoid modifying the original
  const clone = document.body.cloneNode(true) as HTMLElement

  // Remove excluded elements
  for (const selector of EXCLUDED_SELECTORS) {
    clone.querySelectorAll(selector).forEach(el => el.remove())
  }

  // Try to find the main article content
  let contentElement = findMainContent(clone)

  if (!contentElement) {
    // Fallback: use the largest text block
    contentElement = findLargestTextBlock(clone)
  }

  if (!contentElement) {
    // Last resort: use the cleaned body
    contentElement = clone
  }

  // Extract text from paragraphs and headings only for cleaner output
  return extractParagraphText(contentElement)
}

// Extract only paragraph and heading text for cleaner results
function extractParagraphText(element: HTMLElement): string {
  const textBlocks: string[] = []

  // Get all paragraphs and headings
  const contentNodes = element.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')

  for (const node of contentNodes) {
    const text = node.textContent?.trim()
    if (text && text.length > 20) {
      // Skip if it looks like navigation or UI text
      if (isLikelyContent(text)) {
        textBlocks.push(text)
      }
    }
  }

  // If we got very little from paragraphs, fall back to all text
  const result = textBlocks.join('\n\n')
  if (result.length < 500) {
    return cleanText(element.textContent || '')
  }

  return cleanText(result)
}

// Check if text looks like actual article content
function isLikelyContent(text: string): boolean {
  // Skip very short text
  if (text.length < 25) return false

  // Skip if mostly non-letter characters
  const letters = text.replace(/[^a-zA-Z]/g, '')
  if (letters.length < text.length * 0.5) return false

  // Skip common UI patterns
  const skipPatterns = [
    /^(skip to|jump to|go to|back to)/i,
    /^(share|tweet|post|email|print|copy|subscribe|sign up|log in|register)/i,
    /^(next|previous|read more|continue|see also|related)/i,
    /^(advertisement|sponsored|promoted)/i,
    /^(follow us|connect with|join)/i,
    /^(copyright|all rights reserved|terms|privacy)/i,
    /^\d+\s*(comments?|shares?|likes?|views?)/i,
    /^(menu|search|home|about|contact)/i,
  ]

  for (const pattern of skipPatterns) {
    if (pattern.test(text)) return false
  }

  return true
}

// Find the main content element
function findMainContent(root: HTMLElement): HTMLElement | null {
  // Priority order for finding main content
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-content',
    '.post-content',
    '.entry-content',
    '.content',
    '#content',
    '.story-body',
    '.article-body',
  ]

  for (const selector of selectors) {
    const element = root.querySelector(selector)
    if (element && element.textContent && element.textContent.trim().length > 200) {
      return element as HTMLElement
    }
  }

  return null
}

// Find the element with the most text content
function findLargestTextBlock(root: HTMLElement): HTMLElement | null {
  let largest: HTMLElement | null = null
  let maxLength = 0

  const candidates = root.querySelectorAll('div, section, article')

  for (const element of candidates) {
    const text = element.textContent?.trim() || ''
    const paragraphs = element.querySelectorAll('p').length

    // Prefer elements with multiple paragraphs
    if (text.length > maxLength && paragraphs >= 2) {
      maxLength = text.length
      largest = element as HTMLElement
    }
  }

  return largest
}

// Clean and normalize extracted text
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim()
}

// Count words in text
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_ARTICLE') {
    try {
      const article = extractArticle()
      sendResponse({ success: true, article })
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extract article',
      })
    }
  }
  return true // Keep the message channel open for async response
})
