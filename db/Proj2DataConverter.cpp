// ----------------------------------------------------------------------------
#include <string>
#include <vector>
#include <utility>
#include <fstream>
#include <sstream>
#include <iostream>
// ----------------------------------------------------------------------------
typedef std::vector< std::string > StringVect;
typedef std::pair< std::string, std::string > StringPair;
// ----------------------------------------------------------------------------
const int HEAD_LINES = 5;
const int SEP_LINES = 2;
// ----------------------------------------------------------------------------
struct ProdInfo {
    std::string id;
    std::string asin;
    std::string title;
    std::string group;
    StringVect categories;
    std::string description;

    void Reset() {
        id.clear();
        asin.clear();
        title.clear();
        group.clear();
        categories.clear();
        description.clear();
    }
};
// ----------------------------------------------------------------------------
int str_to_int(const std::string & str) {
    int num;
    std::stringstream ss;
    ss << str;
    ss >> num;
    return num;
}
// ----------------------------------------------------------------------------
std::string rm_carriage(const std::string & str) {
    return str.substr(0, str.size()-1);
}
// ----------------------------------------------------------------------------
std::string trim(const std::string & str) {
    size_t first = str.find_first_not_of(' ');
    size_t last = str.find_last_not_of(' ');
    return str.substr(first, (last-first+1));
}
// ----------------------------------------------------------------------------
int read_n_lines(std::fstream & fs, int N, StringVect & lines) {
    lines.clear();
    int K = 0;
    while (!fs.eof() && K < N) {
        std::string line;
        std::getline(fs, line);
        lines.push_back(line);
        ++K;
    }
    return K;
}
// ----------------------------------------------------------------------------
void split_to_pair(const std::string & line, StringPair & sp, const char SEP = ':') {
    size_t pos = line.find_first_of(SEP);
    sp.first = line.substr(0, pos);
    sp.second = line.substr(pos+1, std::string::npos);    // Remove the trailing carriage return char.
}
// ----------------------------------------------------------------------------
std::string _Q(const std::string & str, const char Q = '\"') {
    return Q + str + Q;
}
// ----------------------------------------------------------------------------
std::string toSQL(const ProdInfo & pi) {
    std::ostringstream oss2;
    for (size_t i = 0; i < pi.categories.size(); ++i) {
        oss2 << pi.categories[i] << ";";
    }

    std::ostringstream oss;
    // INSERT INTO Product (ID, Description, Category, Title) VALUES (3, "Diet Coke bottle", "Trash", "Bottle");
    oss << "INSERT INTO `Product` (`ID`, `Description`, `Category`, `Title`) VALUES ("
        << pi.id << ", " << _Q(pi.description) << ", " << _Q(oss2.str())
        << ", " << _Q(pi.title) << ");"
        ;

    return oss.str();
}
// ----------------------------------------------------------------------------
int main(int argc, char * argv[]) {

    std::fstream fs;

    fs.open("Project2Data.txt");

    ProdInfo pi;    // The current product info that is being dealt with.
    while (!fs.eof()) {
        StringVect lines;
        pi.Reset();

        // Read the head lines.
        if (read_n_lines(fs, HEAD_LINES, lines) != HEAD_LINES) {
            // We run out of lines. Just break.
            std::cerr << "Not enough head lines." << std::endl;
            break;
        }

        // Parse the lines.
        StringPair sp;
        split_to_pair(rm_carriage(lines[0]), sp);
        pi.id = trim(sp.second);
        split_to_pair(rm_carriage(lines[1]), sp);
        pi.asin = trim(sp.second);
        split_to_pair(rm_carriage(lines[2]), sp);
        pi.title = trim(sp.second);
        split_to_pair(rm_carriage(lines[3]), sp);
        pi.group = trim(sp.second);

        // Read the categories.
        split_to_pair(lines[4], sp);
        int category_count = str_to_int(trim(sp.second));
        if (read_n_lines(fs, category_count, lines) != category_count) {
            // We run out of lines. Just break.
            std::cerr << "Not enough category lines." << std::endl;
            break;
        }
        for (size_t i = 0; i < lines.size(); ++i) {
            pi.categories.push_back(trim(rm_carriage(lines[i])));
        }

        // Write the product info into a SQL statement.
        std::cout << toSQL(pi) << std::endl;

        // Skip the blank lines.
        read_n_lines(fs, SEP_LINES, lines);
    }

    fs.close();

    return 0;
}
// ----------------------------------------------------------------------------
