// Premier League nationality distribution + per-country name pools.
// Weights are relative (not percentages): a country with weight 300 appears
// ~2x as often as weight 150.
//
// Name pools are common civilian names for each country — deliberately NOT
// the names of real footballers, so generated players never read as (or
// combine into) recognizable pros. Pool sizes scale with the nationality's
// weight: more common nationalities get bigger pools so names repeat less.
export interface NationalityDef {
  weight: number;
  first: string[];
  last: string[];
}

export const NATIONALITIES: Record<string, NationalityDef> = {
  England: {
    weight: 390,
    first: [
      "Harry", "Jack", "James", "George", "Jordan", "Callum", "Mason", "Tyler",
      "Charlie", "Oliver", "Ben", "Sam", "Ryan", "Josh", "Luke", "Connor",
      "Aaron", "Marcus", "Dominic", "Reece", "Curtis", "Ellis", "Kyle", "Declan",
      "Thomas", "Daniel", "Matthew", "Adam", "Nathan", "Liam", "Joe", "Alfie",
      "Archie", "Freddie", "Louie", "Theo", "Ethan", "Noah", "Leo", "Max",
      "Finley", "Toby", "Elliot", "Cameron", "Bradley", "Lewis", "Owen", "Jake",
      "Dylan", "Harvey", "Billy", "Frankie", "Alex", "Will", "Scott", "Andy",
      "Danny", "Michael", "Robbie", "Joel",
    ],
    last: [
      "Smith", "Jones", "Taylor", "Wilson", "Johnson", "White", "Walker", "Robinson",
      "Wright", "Green", "Hall", "Wood", "Baker", "Clarke", "Cooper", "Ward",
      "Hunt", "Foster", "Bennett", "Grant", "Thompson", "Evans", "Roberts", "Turner",
      "Hill", "Moore", "Clark", "Harris", "Lewis", "Allen", "Young", "King",
      "Scott", "Adams", "Mitchell", "Carter", "Phillips", "Parker", "Collins", "Edwards",
      "Morris", "Murphy", "Cook", "Bailey", "Bell", "Kelly", "Howard", "Marsh",
      "Dawson", "Fletcher", "Simpson", "Hudson", "Barnes", "Chapman", "Gibson", "Harrison",
      "Holmes", "Lawson", "Pearson", "Webster",
    ],
  },
  France: {
    weight: 63,
    first: [
      "Antoine", "Paul", "Hugo", "Theo", "Lucas", "Adrien", "Benjamin", "Thomas",
      "Jules", "Louis", "Leo", "Gabriel", "Raphael", "Arthur", "Nathan", "Ethan",
      "Enzo", "Maxime", "Quentin", "Clement", "Romain", "Julien", "Nicolas", "Alexandre",
      "Baptiste", "Florian", "Guillaume", "Mathis", "Noah", "Sacha", "Yanis", "Mehdi",
      "Karim", "Samir", "Amine", "Ibrahim", "Moussa", "Mamadou", "Idrissa", "Sekou",
    ],
    last: [
      "Martin", "Bernard", "Dubois", "Durand", "Moreau", "Laurent", "Simon", "Michel",
      "Lefebvre", "Leroy", "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert",
      "Fontaine", "Rousseau", "Vincent", "Faure", "Andre", "Mercier", "Blanc", "Guerin",
      "Boyer", "Garnier", "Chevalier", "Francois", "Legrand", "Gauthier", "Perrin", "Robin",
      "Clement", "Morel", "Henry", "Renard", "Picard", "Marchand", "Traore", "Diallo",
    ],
  },
  Brazil: {
    weight: 63,
    first: [
      "Gabriel", "Lucas", "Rodrigo", "Thiago", "Danilo", "Everton", "Matheus", "Douglas",
      "Renan", "Arthur", "Fabio", "Rafael", "Pedro", "Joao", "Felipe", "Gustavo",
      "Leonardo", "Marcelo", "Vitor", "Caio", "Diego", "Igor", "Andre", "Henrique",
      "Julio", "Leandro", "Murilo", "Otavio", "Paulo", "Ramon", "Samuel", "Sergio",
      "Wesley", "Wallace", "Yago", "Alex", "Emerson", "Kaique", "Davi", "Luan",
    ],
    last: [
      "Silva", "Santos", "Souza", "Oliveira", "Costa", "Pereira", "Ferreira", "Alves",
      "Barbosa", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araujo", "Nascimento", "Rocha",
      "Dias", "Moreira", "Cardoso", "Teixeira", "Correia", "Lima", "Fernandes", "Neves",
      "Almeida", "Azevedo", "Batista", "Borges", "Campos", "Castro", "Cavalcanti", "Duarte",
      "Farias", "Freitas", "Mendes", "Monteiro", "Nogueira", "Pinto", "Ramos", "Vieira",
    ],
  },
  Spain: {
    weight: 33,
    first: [
      "Alvaro", "Sergio", "Pablo", "Pedro", "Alejandro", "Marco", "Dani", "Rodrigo",
      "Jesus", "Cesar", "Ivan", "Ruben", "Diego", "Carlos", "Mikel", "Unai",
      "Adrian", "Alberto", "Antonio", "David", "Fernando", "Francisco", "Gonzalo", "Hector",
      "Hugo", "Javier", "Jorge", "Manuel", "Miguel", "Raul",
    ],
    last: [
      "Garcia", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Perez", "Sanchez",
      "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Munoz",
      "Alvarez", "Romero", "Gutierrez", "Alonso", "Navarro", "Dominguez", "Vazquez", "Gil",
      "Serrano", "Blanco", "Molina", "Castro", "Ortega", "Delgado",
    ],
  },
  Italy: {
    weight: 30,
    first: [
      "Marco", "Luca", "Matteo", "Alessandro", "Davide", "Simone", "Andrea", "Francesco",
      "Lorenzo", "Riccardo", "Federico", "Gianluca", "Stefano", "Fabio", "Roberto", "Paolo",
      "Giovanni", "Antonio", "Nicola", "Emanuele", "Daniele", "Cristian", "Filippo", "Enrico",
      "Salvatore", "Massimo", "Vincenzo", "Domenico", "Pietro", "Angelo",
    ],
    last: [
      "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
      "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano",
      "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
      "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
    ],
  },
  Portugal: {
    weight: 31,
    first: [
      "Joao", "Diogo", "Ruben", "Pedro", "Rafael", "Nuno", "Goncalo", "Vitor",
      "Rui", "Nelson", "Andre", "Jose", "Fabio", "Tiago", "Bruno", "Miguel",
      "Ricardo", "Hugo", "Paulo", "Sergio", "Carlos", "Antonio", "Manuel", "Francisco",
      "Duarte", "Afonso", "Martim", "Tomas", "Vasco", "Simao",
    ],
    last: [
      "Silva", "Pereira", "Costa", "Santos", "Ferreira", "Oliveira", "Rodrigues", "Martins",
      "Sousa", "Fonseca", "Goncalves", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro",
      "Pinto", "Carvalho", "Teixeira", "Moreira", "Correia", "Mendes", "Nunes", "Soares",
      "Vieira", "Monteiro", "Cardoso", "Rocha", "Antunes", "Machado",
    ],
  },
  Netherlands: {
    weight: 28,
    first: [
      "Daan", "Sem", "Lars", "Thijs", "Bram", "Luuk", "Jesse", "Tim",
      "Niels", "Sven", "Koen", "Ruben", "Stijn", "Joris", "Rick", "Tom",
      "Max", "Thomas", "Jasper", "Wouter", "Bas", "Gijs", "Floris", "Pim",
      "Jelle", "Sander", "Maarten", "Niek", "Teun", "Mees",
    ],
    last: [
      "de Vries", "Jansen", "van den Berg", "Bakker", "Visser", "Smit", "Meijer", "Mulder",
      "Bos", "Vos", "Peters", "Hendriks", "Dekker", "Brouwer", "van Leeuwen", "de Boer",
      "Kuipers", "Veenstra", "Prins", "Huisman", "van der Meer", "Postma", "Scholten", "Willems",
      "Timmermans", "Verhoeven", "Kok", "Jacobs", "Schouten", "Maas",
    ],
  },
  Belgium: {
    weight: 22,
    first: [
      "Lucas", "Arthur", "Noah", "Louis", "Victor", "Jules", "Adam", "Nathan",
      "Thomas", "Maxime", "Simon", "Antoine", "Romain", "Gilles", "Wout", "Senne",
      "Lars", "Milan", "Robbe", "Seppe", "Kobe", "Jarne", "Brent", "Cedric",
    ],
    last: [
      "Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens",
      "Wouters", "De Smet", "Vermeulen", "Hermans", "Pauwels", "Michiels", "Aerts", "De Clercq",
      "Dubois", "Lambert", "Dupont", "Leclercq", "Renard", "Denis", "Lemaire", "Segers",
    ],
  },
  Argentina: {
    weight: 20,
    first: [
      "Nicolas", "Rodrigo", "Cristian", "Marcos", "German", "Nahuel", "Santiago", "Mateo",
      "Joaquin", "Facundo", "Agustin", "Franco", "Ignacio", "Lucas", "Matias", "Tomas",
      "Bruno", "Gonzalo", "Ezequiel", "Federico", "Leandro", "Maximiliano", "Ramiro", "Valentin",
    ],
    last: [
      "Gonzalez", "Rodriguez", "Gomez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez",
      "Garcia", "Sanchez", "Romero", "Sosa", "Alvarez", "Ruiz", "Ramirez", "Flores",
      "Benitez", "Acosta", "Medina", "Herrera", "Aguirre", "Pereyra", "Dominguez", "Molina",
    ],
  },
  Scotland: {
    weight: 18,
    first: [
      "Andy", "John", "Scott", "Callum", "Ryan", "Kieran", "Stuart", "Grant",
      "Kenny", "Liam", "Billy", "Robbie", "Nathan", "Aaron", "Lewis", "Fraser",
      "Euan", "Cameron", "Finlay", "Ross",
    ],
    last: [
      "Campbell", "Stewart", "MacDonald", "Murray", "Ross", "Reid", "Gray", "Duncan",
      "Hamilton", "Wallace", "Kerr", "Ferguson", "Grant", "Boyd", "Craig", "Sinclair",
      "Muir", "Bruce", "Douglas", "Burns",
    ],
  },
  Wales: {
    weight: 16,
    first: [
      "Gareth", "Aaron", "Ben", "Joe", "Daniel", "Ethan", "Harry", "Rhys",
      "Connor", "Dylan", "Owen", "Morgan", "Ieuan", "Osian", "Tomos", "Gethin",
      "Iwan", "Cai", "Steffan", "Elis",
    ],
    last: [
      "Davies", "Williams", "Evans", "Thomas", "Roberts", "Hughes", "Morgan", "Griffiths",
      "Owen", "Rees", "Jenkins", "Powell", "Price", "Morris", "Lloyd", "Edwards",
      "Parry", "Pritchard", "Bowen", "Vaughan",
    ],
  },
  "Republic of Ireland": {
    weight: 15,
    first: [
      "Sean", "Shane", "Conor", "Josh", "Nathan", "Callum", "Adam", "Jason",
      "Evan", "Cian", "Darragh", "Eoin", "Fionn", "Oisin", "Padraig", "Ronan",
      "Tadhg", "Cathal", "Niall", "Dara",
    ],
    last: [
      "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor",
      "O'Neill", "Reilly", "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch",
      "Murray", "Quinn", "Moore", "Nolan",
    ],
  },
  Denmark: {
    weight: 14,
    first: [
      "Mikkel", "Rasmus", "Jonas", "Simon", "Mathias", "Frederik", "Emil", "Oliver",
      "Magnus", "Oscar", "Malthe", "Anders", "Jacob", "Tobias", "Nikolaj", "Soren",
      "Mads", "Kasper", "Lasse", "Gustav",
    ],
    last: [
      "Nielsen", "Jensen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sorensen",
      "Rasmussen", "Jorgensen", "Petersen", "Madsen", "Kristensen", "Olsen", "Thomsen", "Christiansen",
      "Poulsen", "Johansen", "Mortensen", "Knudsen",
    ],
  },
  Germany: {
    weight: 13,
    first: [
      "Lukas", "Finn", "Jonas", "Leon", "Paul", "Felix", "Maximilian", "Jan",
      "Tim", "Niklas", "Fabian", "Florian", "Tobias", "Moritz", "Philipp", "Sebastian",
      "Simon", "David", "Erik", "Hannes",
    ],
    last: [
      "Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker",
      "Schulz", "Hoffmann", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schroder",
      "Neumann", "Braun", "Zimmermann", "Kruger",
    ],
  },
  Nigeria: {
    weight: 12,
    first: [
      "Chinedu", "Emeka", "Ifeanyi", "Chukwudi", "Obinna", "Uche", "Nnamdi", "Kelechi",
      "Adewale", "Ayodele", "Babatunde", "Olamide", "Segun", "Tunde", "Femi", "Musa",
      "Ibrahim", "Suleiman", "Daniel", "Samuel",
    ],
    last: [
      "Okafor", "Okoye", "Eze", "Nwachukwu", "Obi", "Okonkwo", "Ogunleye", "Adeyemi",
      "Adebayo", "Balogun", "Lawal", "Yusuf", "Abubakar", "Mohammed", "Aliyu", "Chukwu",
      "Nnadi", "Olawale", "Oyelami", "Ekwueme",
    ],
  },
  Croatia: {
    weight: 10,
    first: [
      "Luka", "Ivan", "Marko", "Ante", "Josip", "Matej", "Petar", "Tomislav",
      "Stjepan", "Karlo", "Filip", "Lovro", "Roko", "Niko", "Fran", "Duje",
    ],
    last: [
      "Horvat", "Kovacevic", "Babic", "Maric", "Jukic", "Vukovic", "Knezevic", "Tomic",
      "Novak", "Bozic", "Blazevic", "Grgic", "Saric", "Lovric", "Radic", "Filipovic",
    ],
  },
  Norway: {
    weight: 10,
    first: [
      "Magnus", "Henrik", "Jonas", "Sander", "Kristian", "Morten", "Fredrik", "Sondre",
      "Eirik", "Ola", "Lars", "Anders", "Even", "Sindre", "Vegard", "Petter",
    ],
    last: [
      "Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Pedersen", "Nilsen", "Kristiansen",
      "Jensen", "Karlsen", "Johnsen", "Pettersen", "Berg", "Haugen", "Hagen", "Dahl",
    ],
  },
  Sweden: {
    weight: 9,
    first: [
      "Oscar", "William", "Lucas", "Elias", "Hugo", "Filip", "Anton", "Gustav",
      "Axel", "Erik", "Viktor", "Nils", "Adam", "Albin", "Melvin", "Casper",
    ],
    last: [
      "Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson",
      "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Lindberg",
    ],
  },
  Poland: {
    weight: 8,
    first: [
      "Jakub", "Kamil", "Wojciech", "Karol", "Jan", "Sebastian", "Piotr", "Mateusz",
      "Szymon", "Bartosz", "Michal", "Krzysztof", "Marcin", "Dawid",
    ],
    last: [
      "Nowak", "Kowalski", "Wisniewski", "Wojcik", "Kowalczyk", "Kaminski", "Szymanski", "Wozniak",
      "Dabrowski", "Kozlowski", "Jankowski", "Mazur", "Krawczyk", "Piotrowski",
    ],
  },
  Ukraine: {
    weight: 8,
    first: [
      "Andriy", "Oleksandr", "Ruslan", "Mykola", "Viktor", "Artem", "Taras", "Yevhen",
      "Denys", "Illia", "Bohdan", "Dmytro", "Maksym", "Vladyslav",
    ],
    last: [
      "Kovalenko", "Boyko", "Tkachenko", "Kravchenko", "Bondarenko", "Oliynyk", "Shevchuk", "Polishchuk",
      "Lysenko", "Rudenko", "Savchenko", "Melnyk", "Marchenko", "Kovalchuk",
    ],
  },
  Ghana: {
    weight: 8,
    first: [
      "Kwame", "Kofi", "Kwesi", "Yaw", "Kojo", "Kwabena", "Akwasi", "Nana",
      "Ebenezer", "Prince", "Emmanuel", "Isaac", "Richmond", "Gideon",
    ],
    last: [
      "Mensah", "Owusu", "Osei", "Boateng", "Asante", "Appiah", "Adjei", "Agyemang",
      "Ofori", "Amoah", "Darko", "Ankrah", "Tetteh", "Quaye",
    ],
  },
  Serbia: {
    weight: 7,
    first: [
      "Nemanja", "Aleksandar", "Filip", "Luka", "Ivan", "Uros", "Marko", "Nikola",
      "Stefan", "Dusan", "Milos", "Vuk", "Petar", "Lazar",
    ],
    last: [
      "Jovanovic", "Petrovic", "Nikolic", "Markovic", "Djordjevic", "Stojanovic", "Stankovic", "Todorovic",
      "Ristic", "Zivkovic", "Lazic", "Vasic", "Simic", "Lukic",
    ],
  },
  Cameroon: {
    weight: 7,
    first: [
      "Jean", "Paul", "Pierre", "Serge", "Alain", "Patrick", "Cyrille", "Rodrigue",
      "Landry", "Thierry", "Arnaud", "Blaise", "Herve", "Francis",
    ],
    last: [
      "Mbarga", "Fotso", "Kamga", "Ngono", "Essomba", "Owona", "Atangana", "Etoundi",
      "Mballa", "Ndongo", "Tsafack", "Djoum", "Bekono", "Manga",
    ],
  },
  "Ivory Coast": {
    weight: 6,
    first: [
      "Jean", "Ibrahim", "Christian", "Didier", "Souleymane", "Mamadou", "Ousmane", "Abdoulaye",
      "Bakary", "Moussa", "Seydou", "Lacina",
    ],
    last: [
      "Toure", "Kone", "Ouattara", "Coulibaly", "Diabate", "Kouassi", "Kouame", "Yao",
      "Konan", "Bamba", "Fofana", "Doumbia",
    ],
  },
  "United States": {
    weight: 6,
    first: [
      "Tyler", "Brandon", "Austin", "Jake", "Caleb", "Logan", "Mason", "Hunter",
      "Dillon", "Chase", "Cody", "Trevor",
    ],
    last: [
      "Miller", "Davis", "Anderson", "Thompson", "Martin", "Garcia", "Martinez", "Hernandez",
      "Jackson", "Brooks", "Sullivan", "Bennett",
    ],
  },
  Switzerland: {
    weight: 5,
    first: [
      "Luca", "Noah", "Leon", "Nico", "Jan", "Fabio", "Silvan", "Joel",
      "Dario", "Marco", "Sandro", "Livio",
    ],
    last: [
      "Meier", "Muller", "Keller", "Huber", "Schneider", "Weber", "Baumann", "Frei",
      "Brunner", "Steiner", "Widmer", "Bianchi",
    ],
  },
  Japan: {
    weight: 5,
    first: [
      "Haruto", "Yuto", "Sota", "Ren", "Kaito", "Daiki", "Riku", "Kenta",
      "Shota", "Yuki", "Hiroto", "Kazuki",
    ],
    last: [
      "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Yamamoto", "Nakamura", "Kobayashi",
      "Kato", "Yoshida", "Yamada", "Sasaki",
    ],
  },
  "South Korea": {
    weight: 5,
    first: [
      "Min-jun", "Ji-hoon", "Dong-hyun", "Hyun-woo", "Ji-ho", "Jun-seo", "Seung-min", "Woo-jin",
      "Tae-yang", "Ye-jun", "Do-yun", "Si-woo",
    ],
    last: ["Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim", "Han", "Oh"],
  },
  Austria: {
    weight: 4,
    first: ["Lukas", "Tobias", "Florian", "Simon", "Elias", "Julian", "Matthias", "Paul", "Jonas", "Felix"],
    last: ["Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner"],
  },
  "Czech Republic": {
    weight: 4,
    first: ["Jan", "Jakub", "Tomas", "Adam", "Matej", "Ondrej", "Filip", "Vojtech", "Dominik", "Lukas"],
    last: ["Novak", "Svoboda", "Novotny", "Dvorak", "Cerny", "Prochazka", "Kucera", "Vesely", "Horak", "Nemec"],
  },
  Turkey: {
    weight: 4,
    first: ["Emre", "Mert", "Can", "Efe", "Yusuf", "Ahmet", "Mehmet", "Mustafa", "Umut", "Berkay"],
    last: ["Yilmaz", "Kaya", "Demir", "Celik", "Sahin", "Yildirim", "Ozturk", "Aydin", "Arslan", "Dogan"],
  },
  Algeria: {
    weight: 3,
    first: ["Mohamed", "Amine", "Yacine", "Sofiane", "Bilal", "Walid", "Karim", "Rayan", "Adel", "Farid"],
    last: ["Benali", "Bouazza", "Cherif", "Hamdi", "Meziane", "Belkacem", "Saadi", "Mansouri", "Kaci", "Djebbar"],
  },
  Morocco: {
    weight: 3,
    first: ["Mohamed", "Youssef", "Omar", "Anas", "Hamza", "Ayoub", "Zakaria", "Ilias", "Reda", "Badr"],
    last: ["Alaoui", "Benjelloun", "El Amrani", "Tazi", "Berrada", "Chraibi", "El Idrissi", "Bennani", "Lahlou", "Sebti"],
  },
  Senegal: {
    weight: 3,
    first: ["Mamadou", "Ousmane", "Abdoulaye", "Cheikh", "Ibrahima", "Modou", "Pape", "Serigne", "Aliou", "Babacar"],
    last: ["Ndiaye", "Diop", "Fall", "Gueye", "Sy", "Ba", "Faye", "Sarr", "Niang", "Diouf"],
  },
  Mexico: {
    weight: 3,
    first: ["Jose", "Luis", "Juan", "Carlos", "Jorge", "Miguel", "Fernando", "Ricardo", "Eduardo", "Alejandro"],
    last: ["Hernandez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Rodriguez", "Sanchez", "Ramirez", "Cruz", "Vargas"],
  },
  Canada: {
    weight: 2,
    first: ["Liam", "Ethan", "Noah", "Owen", "Lucas", "Nathan", "Cole", "Carter", "Evan", "Tristan"],
    last: ["Tremblay", "Roy", "Gagnon", "MacLeod", "Fraser", "Bouchard", "Cote", "Morin", "Leblanc", "Ross"],
  },
  Australia: {
    weight: 2,
    first: ["Lachlan", "Cooper", "Riley", "Mitchell", "Brayden", "Zac", "Jayden", "Flynn", "Bailey", "Angus"],
    last: ["Kennedy", "O'Neill", "Marsh", "Hughes", "Fitzgerald", "Watson", "Nash", "Payne", "Draper", "Sutton"],
  },
  Finland: {
    weight: 2,
    first: ["Onni", "Eetu", "Aleksi", "Ville", "Juho", "Niko", "Samu", "Arttu", "Joona", "Elias"],
    last: ["Korhonen", "Virtanen", "Makinen", "Nieminen", "Hamalainen", "Laine", "Heikkinen", "Koskinen", "Jarvinen", "Lehtonen"],
  },
  Romania: {
    weight: 2,
    first: ["Andrei", "Alexandru", "Stefan", "Mihai", "Ionut", "Gabriel", "Vlad", "Darius", "Razvan", "Cristian"],
    last: ["Popescu", "Ionescu", "Popa", "Radu", "Dumitrescu", "Stan", "Stoica", "Munteanu", "Gheorghe", "Matei"],
  },
  Slovakia: {
    weight: 2,
    first: ["Martin", "Tomas", "Peter", "Michal", "Jakub", "Lukas", "Matus", "Samuel", "Adam", "Filip"],
    last: ["Kovac", "Horvath", "Varga", "Toth", "Nagy", "Balaz", "Molnar", "Szabo", "Lukac", "Polak"],
  },
  Slovenia: {
    weight: 2,
    first: ["Luka", "Jan", "Nejc", "Ziga", "Anze", "Tilen", "Gasper", "Rok", "Blaz", "Matic"],
    last: ["Novak", "Horvat", "Krajnc", "Zupancic", "Potocnik", "Kovac", "Mlakar", "Vidmar", "Golob", "Turk"],
  },
  Iceland: {
    weight: 2,
    first: ["Jon", "Gunnar", "Bjarni", "Kristjan", "Olafur", "Einar", "Magnus", "Arnar", "Dagur", "Haukur"],
    last: ["Jonsson", "Gunnarsson", "Einarsson", "Magnusson", "Olafsson", "Kristjansson", "Arnarsson", "Thorsteinsson", "Halldorsson", "Palsson"],
  },
  Mali: {
    weight: 2,
    first: ["Moussa", "Amadou", "Boubacar", "Cheick", "Seydou", "Modibo", "Souleymane", "Adama", "Drissa", "Mamadou"],
    last: ["Traore", "Coulibaly", "Keita", "Diarra", "Sidibe", "Kone", "Doumbia", "Diallo", "Camara", "Sanogo"],
  },
  "Burkina Faso": {
    weight: 1,
    first: ["Issa", "Adama", "Boureima", "Salif", "Idrissa", "Harouna", "Karim", "Zakaria"],
    last: ["Ouedraogo", "Kabore", "Sawadogo", "Zongo", "Compaore", "Nikiema", "Sanou", "Ilboudo"],
  },
  "DR Congo": {
    weight: 1,
    first: ["Cedric", "Yannick", "Gael", "Jonathan", "Patrick", "Christian", "Glody", "Dieudonne"],
    last: ["Kabongo", "Ilunga", "Mukendi", "Tshibanda", "Kalonji", "Mbuyi", "Ngoy", "Kasongo"],
  },
  Guinea: {
    weight: 1,
    first: ["Mohamed", "Ibrahima", "Ousmane", "Sekou", "Alseny", "Mamadi", "Fode", "Lansana"],
    last: ["Camara", "Sylla", "Bah", "Barry", "Conde", "Soumah", "Cisse", "Toure"],
  },
  Uruguay: {
    weight: 1,
    first: ["Santiago", "Matias", "Agustin", "Facundo", "Diego", "Bruno", "Emiliano", "Maximiliano"],
    last: ["Perez", "Rodriguez", "Fernandez", "Gonzalez", "Silva", "Pereira", "Sosa", "Techera"],
  },
  Colombia: {
    weight: 1,
    first: ["Juan", "Camilo", "Andres", "Santiago", "Sebastian", "Mateo", "Daniel", "Felipe"],
    last: ["Gomez", "Restrepo", "Cardona", "Arango", "Betancur", "Salazar", "Castano", "Giraldo"],
  },
  Ecuador: {
    weight: 1,
    first: ["Carlos", "Luis", "Angel", "Jefferson", "Bryan", "Kevin", "Jhon", "Darwin"],
    last: ["Zambrano", "Cedeno", "Mendez", "Quinonez", "Vera", "Espinoza", "Palacios", "Chila"],
  },
  Paraguay: {
    weight: 1,
    first: ["Oscar", "Victor", "Hugo", "Cesar", "Ruben", "Osvaldo", "Blas", "Adalberto"],
    last: ["Benitez", "Caceres", "Villalba", "Ayala", "Franco", "Ortiz", "Riveros", "Ruiz Diaz"],
  },
  Venezuela: {
    weight: 1,
    first: ["Jose", "Miguel", "Rafael", "Alejandro", "Jesus", "Eduardo", "Anthony", "Jhonny"],
    last: ["Blanco", "Castillo", "Rivas", "Guerra", "Paez", "Mendoza", "Colmenares", "Aponte"],
  },
};

// "Other Nations (combined)" bucket — a country is picked uniformly among
// these when the weighted roll lands in that combined slot.
export const OTHER_NATIONS: Record<string, { first: string[]; last: string[] }> = {
  Egypt: {
    first: ["Ahmed", "Mohamed", "Mahmoud", "Mostafa", "Omar", "Youssef", "Khaled", "Tarek"],
    last: ["Hassan", "Ibrahim", "Mahmoud", "Abdelrahman", "Fathy", "Ramadan", "Shawky", "Kamal"],
  },
  Tunisia: {
    first: ["Mohamed", "Ahmed", "Youssef", "Anis", "Bilel", "Hamza", "Seifeddine", "Oussama"],
    last: ["Trabelsi", "Jebali", "Gharbi", "Mansouri", "Hammami", "Chebbi", "Dridi", "Ayari"],
  },
  Chile: {
    first: ["Matias", "Benjamin", "Vicente", "Joaquin", "Cristobal", "Diego", "Felipe", "Ignacio"],
    last: ["Munoz", "Rojas", "Soto", "Contreras", "Silva", "Fuentes", "Espinoza", "Araya"],
  },
  Peru: {
    first: ["Luis", "Jose", "Carlos", "Jorge", "Miguel", "Renzo", "Alonso", "Piero"],
    last: ["Quispe", "Flores", "Huaman", "Chavez", "Rojas", "Torres", "Castillo", "Salazar"],
  },
  Bolivia: {
    first: ["Juan", "Carlos", "Luis", "Marco", "Ronald", "Diego", "Jhasmani", "Rodrigo"],
    last: ["Mamani", "Quispe", "Flores", "Condori", "Choque", "Vargas", "Rojas", "Gutierrez"],
  },
  Iran: {
    first: ["Ali", "Reza", "Amir", "Hossein", "Mehdi", "Saeid", "Arman", "Pouya"],
    last: ["Hosseini", "Ahmadi", "Rezaei", "Moradi", "Jafari", "Kazemi", "Sadeghi", "Ebrahimi"],
  },
  China: {
    first: ["Wei", "Jun", "Hao", "Lei", "Ming", "Bo", "Tao", "Chen"],
    last: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao"],
  },
  India: {
    first: ["Arjun", "Rohan", "Rahul", "Vikram", "Aditya", "Karan", "Nikhil", "Sanjay"],
    last: ["Sharma", "Singh", "Kumar", "Patel", "Nair", "Das", "Reddy", "Verma"],
  },
  Israel: {
    first: ["Noam", "Itai", "Yonatan", "Amit", "Omer", "Daniel", "Gal", "Idan"],
    last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Avraham", "Dahan", "Azoulay"],
  },
  "New Zealand": {
    first: ["Liam", "Jack", "Oliver", "Hunter", "Mason", "Blake", "Finn", "Toby"],
    last: ["Wilson", "Thompson", "Anderson", "Walker", "Harris", "Ngata", "Parata", "Clarke"],
  },
  Jamaica: {
    first: ["Andre", "Damion", "Shane", "Ricardo", "Omar", "Devon", "Kemar", "Jerome"],
    last: ["Brown", "Williams", "Campbell", "Grant", "Reid", "Thompson", "Blake", "Morrison"],
  },
  "Costa Rica": {
    first: ["Jose", "Carlos", "Luis", "Andres", "Esteban", "Randall", "Marco", "Kenneth"],
    last: ["Vargas", "Rodriguez", "Jimenez", "Mora", "Solano", "Chaves", "Rojas", "Salas"],
  },
  Honduras: {
    first: ["Carlos", "Jorge", "Marvin", "Wilmer", "Selvin", "Edwin", "Jerry", "Oscar"],
    last: ["Martinez", "Lopez", "Flores", "Mejia", "Castro", "Zelaya", "Padilla", "Espinal"],
  },
  Panama: {
    first: ["Jose", "Luis", "Alberto", "Ricardo", "Armando", "Rolando", "Ismael", "Gabriel"],
    last: ["Gonzalez", "Rodriguez", "Perez", "Castillo", "Sanchez", "Aguilar", "Beitia", "Camargo"],
  },
  Zambia: {
    first: ["Emmanuel", "Chanda", "Mwape", "Kelvin", "Lubinda", "Gift", "Brian", "Moses"],
    last: ["Banda", "Phiri", "Mwansa", "Tembo", "Zulu", "Mulenga", "Chirwa", "Musonda"],
  },
  Kenya: {
    first: ["Brian", "Kevin", "Dennis", "Collins", "Victor", "Eric", "Samuel", "Joseph"],
    last: ["Otieno", "Mwangi", "Kamau", "Ochieng", "Njoroge", "Kiprop", "Wafula", "Mutua"],
  },
  Gabon: {
    first: ["Denis", "Bruno", "Guy", "Serge", "Herve", "Franck", "Ulrich", "Yannis"],
    last: ["Ondo", "Nzue", "Moussavou", "Obiang", "Mba", "Ekomy", "Ivanga", "Ndong"],
  },
  Angola: {
    first: ["Joao", "Pedro", "Manuel", "Antonio", "Domingos", "Helder", "Wilson", "Edmilson"],
    last: ["dos Santos", "Fernandes", "Cabral", "Sebastiao", "Neto", "Gomes", "Lourenco", "Panzo"],
  },
  Tanzania: {
    first: ["Juma", "Hamisi", "Rashidi", "Selemani", "Abdallah", "Issa", "Hassan", "Baraka"],
    last: ["Said", "Mushi", "Massawe", "Shayo", "Kimaro", "Swai", "Temba", "Lyimo"],
  },
  "South Africa": {
    first: ["Sipho", "Thabo", "Bongani", "Themba", "Lucky", "Katlego", "Sibusiso", "Andile"],
    last: ["Dlamini", "Nkosi", "Khumalo", "Mokoena", "Ndlovu", "Mahlangu", "Sithole", "Mabaso"],
  },
};

const OTHER_BUCKET_WEIGHT = 8;

/**
 * The weight a home country's own nationality gets in its own leagues,
 * matching England's existing dominant share in the original flat
 * distribution (so "Spanish leagues draw mostly Spanish names" has the same
 * intensity "English leagues draw mostly English names" always has).
 */
const HOME_NATION_WEIGHT = 390;

function totalWeight(table: Record<string, NationalityDef>): number {
  let sum = OTHER_BUCKET_WEIGHT;
  for (const def of Object.values(table)) sum += def.weight;
  return sum;
}

function pickFromTable(rng: () => number, table: Record<string, NationalityDef>): string {
  let roll = rng() * totalWeight(table);
  for (const [country, def] of Object.entries(table)) {
    if (roll < def.weight) return country;
    roll -= def.weight;
  }
  const others = Object.keys(OTHER_NATIONS);
  return others[Math.floor(rng() * others.length)];
}

/**
 * Weighted-random nationality draw. With no homeCountry (or "England"),
 * matches the original flat Premier-League-flavored distribution exactly.
 * With a homeCountry that has its own NATIONALITIES entry, that country's
 * weight is boosted to HOME_NATION_WEIGHT (England's weight drops to what
 * the home country's own weight normally is — a straight swap, so the total
 * weight pool is unchanged) — every other country's weight is untouched,
 * so the "realistic foreign mix" flavor carries over unmodified.
 */
export function pickNationality(rng: () => number, homeCountry?: string): string {
  if (!homeCountry || homeCountry === "England" || !(homeCountry in NATIONALITIES)) {
    return pickFromTable(rng, NATIONALITIES);
  }
  const homeDef = NATIONALITIES[homeCountry];
  const table: Record<string, NationalityDef> = {
    ...NATIONALITIES,
    [homeCountry]: { ...homeDef, weight: HOME_NATION_WEIGHT },
    England: { ...NATIONALITIES.England, weight: homeDef.weight },
  };
  return pickFromTable(rng, table);
}

export function namePoolFor(nationality: string): { first: string[]; last: string[] } | undefined {
  return NATIONALITIES[nationality] ?? OTHER_NATIONS[nationality];
}
