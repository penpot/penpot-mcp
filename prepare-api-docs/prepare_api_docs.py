import os
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from markdownify import MarkdownConverter
from sensai.util import logging

log = logging.getLogger(__name__)


class PenpotAPIContentMarkdownConverter(MarkdownConverter):
    """
    Markdown converter for Penpot API docs, specifically for the .col-content element
    """
    def process_tag(self, node, parent_tags=None):
        soup = BeautifulSoup(str(node), "html.parser")

        # skip breadcrumbs
        if "class" in node.attrs and "tsd-breadcrumb" in node.attrs["class"]:
            return ""

        # convert h3 and h4 to plain text
        if node.name in ["h5", "h4"]:
            return soup.get_text()

        text = soup.get_text()

        # convert tags for "Readonly" and "Optional" designations
        if node.name == "code" and "class" in node.attrs and "tsd-tag" in node.attrs["class"]:
            return ""

        # skip buttons (e.g. "Copy")
        if node.name == "button":
            return ""

        # skip links to definitions in <li> elements
        if node.name == "li" and text.startswith("Defined in"):
            return ""

        # for links, just return the text
        if node.name == "a":
            return text

        # skip inheritance information
        if node.name == "p" and text.startswith("Inherited from"):
            return ""

        # remove index with links
        if "class" in node.attrs and "tsd-index-content" in node.attrs["class"]:
            return ""

        # convert <pre> blocks to markdown code blocks
        if node.name == "pre":
            return f"\n```\n{text.strip()}\n```\n\n"

        # convert tsd-signature elements to code blocks, converting <br> to newlines
        if "class" in node.attrs and "tsd-signature" in node.attrs["class"]:
            for br in soup.find_all("br"):
                br.replace_with("\n")
            return f"\n```\n{soup.get_text()}\n```\n\n"

        # other cases: use the default processing
        return super().process_tag(node, parent_tags=parent_tags)


class PenpotAPIDocsProcessor:
    def __init__(self):
        self.md_converter = PenpotAPIContentMarkdownConverter()
        self.base_url = "https://penpot-plugins-api-doc.pages.dev"
        self.pages = {}

    def run(self, target_dir: str):
        os.makedirs(target_dir, exist_ok=True)

        # find links
        modules_page = self._fetch("modules")
        soup = BeautifulSoup(modules_page, "html.parser")
        content = soup.find(attrs={"class": "col-content"})
        links = content.find_all("a", href=True)

        # process each link, converting interface and type pages to markdown
        for link in links:
            href = link['href']
            if href.startswith("interfaces/") or href.startswith("types/"):
                page_name = href.split("/")[-1].replace(".html", "")
                log.info("Processing page: %s", page_name)
                page_md = self._process_page(href)

                # save to md file
                md_path = os.path.abspath(os.path.join(target_dir, f"{page_name}.md"))
                log.info("Writing %s", md_path)
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(page_md)

    def _fetch(self, rel_url: str) -> str:
        response = requests.get(f"{self.base_url}/{rel_url}")
        if response.status_code != 200:
            raise Exception(f"Failed to retrieve page: {response.status_code}")
        html_content = response.text
        return html_content

    def _process_page(self, rel_url: str):
        html_content = self._fetch(rel_url)
        soup = BeautifulSoup(html_content, "html.parser")

        content = soup.find(attrs={"class": "col-content"})

        markdown = self.md_converter.convert(str(content))
        return markdown


def main():
    target_dir = Path(__file__).parent.parent / "mcp-server" / "data" / "api"
    PenpotAPIDocsProcessor().run(target_dir=str(target_dir))


if __name__ == '__main__':
    logging.run_main(main)
