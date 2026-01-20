package service

import (
	"encoding/json"
	"os"
	"strings"
	"unicode"
)

// Special token IDs for BERT-style models
const (
	TokenCLS = 101 // [CLS] - start of sequence
	TokenSEP = 102 // [SEP] - end of sequence
	TokenPAD = 0   // [PAD] - padding
	TokenUNK = 100 // [UNK] - unknown token
)

// Tokenizer handles text tokenization for BERT-style models
type Tokenizer struct {
	vocab    map[string]int32
	invVocab map[int32]string
	maxLen   int
}

// TokenizerConfig represents the tokenizer.json structure
type TokenizerConfig struct {
	Model struct {
		Vocab map[string]int `json:"vocab"`
	} `json:"model"`
}

// NewTokenizer loads a tokenizer from tokenizer.json
func NewTokenizer(tokenizerPath string, maxLen int) (*Tokenizer, error) {
	data, err := os.ReadFile(tokenizerPath)
	if err != nil {
		return nil, err
	}

	var config TokenizerConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	vocab := make(map[string]int32, len(config.Model.Vocab))
	invVocab := make(map[int32]string, len(config.Model.Vocab))

	for token, id := range config.Model.Vocab {
		vocab[token] = int32(id)
		invVocab[int32(id)] = token
	}

	return &Tokenizer{
		vocab:    vocab,
		invVocab: invVocab,
		maxLen:   maxLen,
	}, nil
}

// Encode tokenizes text into input IDs with attention mask
func (t *Tokenizer) Encode(text string) (inputIDs, attentionMask []int64) {
	// Normalize and clean text
	text = strings.ToLower(strings.TrimSpace(text))

	// Tokenize
	tokens := t.tokenize(text)

	// Add special tokens: [CLS] tokens [SEP]
	inputIDs = make([]int64, t.maxLen)
	attentionMask = make([]int64, t.maxLen)

	inputIDs[0] = TokenCLS
	attentionMask[0] = 1

	pos := 1
	for _, token := range tokens {
		if pos >= t.maxLen-1 { // Leave room for [SEP]
			break
		}
		inputIDs[pos] = int64(token)
		attentionMask[pos] = 1
		pos++
	}

	inputIDs[pos] = TokenSEP
	attentionMask[pos] = 1

	// Rest is padding (already 0)
	return inputIDs, attentionMask
}

// tokenize converts text to token IDs using WordPiece
func (t *Tokenizer) tokenize(text string) []int32 {
	var tokens []int32

	// Split into words (simple whitespace split + punctuation handling)
	words := t.splitIntoWords(text)

	for _, word := range words {
		wordTokens := t.tokenizeWord(word)
		tokens = append(tokens, wordTokens...)
	}

	return tokens
}

// splitIntoWords splits text into words, separating punctuation
func (t *Tokenizer) splitIntoWords(text string) []string {
	var words []string
	var current strings.Builder

	for _, r := range text {
		if unicode.IsSpace(r) {
			if current.Len() > 0 {
				words = append(words, current.String())
				current.Reset()
			}
		} else if unicode.IsPunct(r) {
			if current.Len() > 0 {
				words = append(words, current.String())
				current.Reset()
			}
			words = append(words, string(r))
		} else {
			current.WriteRune(r)
		}
	}

	if current.Len() > 0 {
		words = append(words, current.String())
	}

	return words
}

// tokenizeWord converts a single word to tokens using WordPiece
func (t *Tokenizer) tokenizeWord(word string) []int32 {
	// Check if whole word is in vocab
	if id, ok := t.vocab[word]; ok {
		return []int32{id}
	}

	// WordPiece: try to match longest subwords
	var tokens []int32
	start := 0

	for start < len(word) {
		end := len(word)
		found := false

		for end > start {
			substr := word[start:end]
			if start > 0 {
				substr = "##" + substr // Continuation prefix
			}

			if id, ok := t.vocab[substr]; ok {
				tokens = append(tokens, id)
				start = end
				found = true
				break
			}
			end--
		}

		if !found {
			// Unknown character, use [UNK]
			tokens = append(tokens, TokenUNK)
			start++
		}
	}

	return tokens
}

// VocabSize returns the vocabulary size
func (t *Tokenizer) VocabSize() int {
	return len(t.vocab)
}
