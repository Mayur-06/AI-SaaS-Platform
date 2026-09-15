from langchain_text_splitters import RecursiveCharacterTextSplitter

class TextChunker:
    def __init__(self, chunk_size=500, chunk_overlap=75):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
                separators=[
        "\n\n",              # split by paragraph first
        "\n",                # then by line
        ". ",                # then by sentence
        "? ",
        "! ",
        "; ",
        ", ",
        " ",                 # then by words
        ""                   # finally by characters
    ],
    length_function=len,
    is_separator_regex=False,
    )

    def chunk_text(self, text):
        return self.text_splitter.split_text(text)