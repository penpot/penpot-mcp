import dataclasses
import os
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Tag
from markdownify import MarkdownConverter
from ruamel.yaml import YAML
from ruamel.yaml.scalarstring import LiteralScalarString
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

        # convert h5 and h4 to plain text
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
            for button in soup.find_all("button"):
                button.decompose()
            return f"\n```\n{soup.get_text().strip()}\n```\n\n"

        # convert tsd-signature elements to code blocks, converting <br> to newlines
        if "class" in node.attrs and "tsd-signature" in node.attrs["class"]:
            for br in soup.find_all("br"):
                br.replace_with("\n")
            return f"\n```\n{soup.get_text()}\n```\n\n"

        # other cases: use the default processing
        return super().process_tag(node, parent_tags=parent_tags)


@dataclass
class TypeInfo:
    overview: str
    """
    the main type information, which contains all the declarations/signatures but no descriptions
    """
    members: dict[str, dict[str, str]]
    """
    mapping from member type (e.g. "Properties", "Methods") to a mapping of member name to markdown description
    """


class YamlConverter:
    """Convert dictionaries to YAML with all strings in block literal style"""

    def __init__(self):
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.width = 4096  # Prevent line wrapping

    def _convert_strings_to_block(self, obj):
        if isinstance(obj, dict):
            return {k: self._convert_strings_to_block(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_strings_to_block(item) for item in obj]
        elif isinstance(obj, str):
            return LiteralScalarString(obj)
        else:
            return obj

    def to_yaml(self, data):
        processed_data = self._convert_strings_to_block(data)
        stream = StringIO()
        self.yaml.dump(processed_data, stream)
        return stream.getvalue()

    def to_file(self, data, filepath):
        processed_data = self._convert_strings_to_block(data)
        with open(filepath, 'w', encoding='utf-8') as f:
            self.yaml.dump(processed_data, f)


class PenpotAPIDocsProcessor:
    def __init__(self):
        self.md_converter = PenpotAPIContentMarkdownConverter()
        self.base_url = "https://penpot-plugins-api-doc.pages.dev"
        self.types: dict[str, TypeInfo] = {}

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
                type_name = href.split("/")[-1].replace(".html", "")
                log.info("Processing page: %s", type_name)
                type_info = self._process_page(href)
                self.types[type_name] = type_info

        # save to yaml
        yaml_path = os.path.join(target_dir, "api_types.yml")
        log.info("Writing API type information to %s", yaml_path)
        data_dict = {k: dataclasses.asdict(v) for k, v in self.types.items()}
        YamlConverter().to_file(data_dict, yaml_path)

    def _fetch(self, rel_url: str) -> str:
        response = requests.get(f"{self.base_url}/{rel_url}")
        if response.status_code != 200:
            raise Exception(f"Failed to retrieve page: {response.status_code}")
        html_content = response.text
        return html_content

    def _html_to_markdown(self, html_content: str) -> str:
        md = self.md_converter.convert(html_content)
        md = md.replace("\xa0", " ")  # replace non-breaking spaces
        return md.strip()

    def _process_page(self, rel_url: str) -> TypeInfo:
        html_content = self._fetch(rel_url)
        soup = BeautifulSoup(html_content, "html.parser")

        content = soup.find(attrs={"class": "col-content"})
        # full_text = self._html_to_markdown(str(content))

        # extract individual members
        members = {}
        member_group_tags = []
        for el in content.children:
            if isinstance(el, Tag):
                if "class" in el.attrs and "tsd-member-group" in el.attrs["class"]:
                    member_group_tags.append(el)
                    members_type = el.find("h2").get_text().strip()
                    members_in_group = {}
                    members[members_type] = members_in_group
                    for member_tag in el.find_all(attrs={"class": "tsd-member"}):
                        member_anchor = member_tag.find("a", attrs={"class": "tsd-anchor"}, recursive=False)
                        member_name = member_anchor.attrs["id"]
                        member_tag.find("h3").decompose()  # remove heading
                        members_in_group[member_name] = self._html_to_markdown(str(member_tag))

        # remove the member groups from the soup
        for tag in member_group_tags:
            tag.decompose()

        # overview is what remains in content after removing member groups
        overview = self._html_to_markdown(str(content))

        return TypeInfo(
            overview=overview,
            members=members
        )


def main():
    target_dir = Path(__file__).parent.parent / "mcp-server" / "data"
    PenpotAPIDocsProcessor().run(target_dir=str(target_dir))


if __name__ == '__main__':
    logging.run_main(main)
