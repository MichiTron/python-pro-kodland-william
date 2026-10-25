"""M5-ia 115660 - Funcion summarization: resumen extractivo con NLTK."""
import string
from collections import Counter

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import sent_tokenize, word_tokenize

for recurso in ("punkt", "punkt_tab", "stopwords", "wordnet"):
    nltk.download(recurso, quiet=True)


def summarization(text, n_sentences=3, language="english"):
    """Devuelve un resumen con las n frases mas relevantes, en su orden original."""
    sentences = sent_tokenize(text, language=language)
    if len(sentences) <= n_sentences:
        return text

    stop_words = set(stopwords.words(language))
    # WordNet solo lematiza ingles; en otros idiomas se usa la palabra tal cual.
    lemmatizer = WordNetLemmatizer() if language == "english" else None

    def clean_words(sentence):
        words = word_tokenize(sentence.lower(), language=language)
        words = [w for w in words if w.isalpha() and w not in stop_words]
        return [lemmatizer.lemmatize(w) for w in words] if lemmatizer else words

    words_per_sentence = [clean_words(s) for s in sentences]
    frequencies = Counter(w for words in words_per_sentence for w in words)

    # Puntuacion: suma de frecuencias normalizada por longitud (no favorece frases largas).
    scores = {}
    for i, words in enumerate(words_per_sentence):
        if words:
            scores[i] = sum(frequencies[w] for w in words) / len(words)

    best = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:n_sentences]
    selected_sentences = sorted(best)  # orden original del texto
    return " ".join([sentences[i] for i, _ in selected_sentences])


if __name__ == "__main__":
    texto_en = (
        "Artificial intelligence is changing the world. Machine learning models learn patterns from data. "
        "Many companies use artificial intelligence to automate tasks. The weather was nice yesterday. "
        "Data is the fuel of machine learning, and good data makes better models. "
        "Researchers keep improving artificial intelligence every year."
    )
    texto_es = (
        "La inteligencia artificial esta cambiando el mundo. Los modelos de aprendizaje automatico aprenden patrones de los datos. "
        "Muchas empresas usan la inteligencia artificial para automatizar tareas. Ayer hizo buen tiempo. "
        "Los datos son el combustible del aprendizaje automatico, y mejores datos dan mejores modelos. "
        "Los investigadores mejoran la inteligencia artificial cada ano."
    )
    print(summarization(texto_en, 2))
    print(summarization(texto_es, 2, language="spanish"))
