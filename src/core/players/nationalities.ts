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
      "Danny", "Michael", "Robbie", "Joel", "Patrick", "Stephen", "Christopher", "Andrew",
      "Peter", "Philip", "Richard", "Robert", "William", "Edward", "Henry", "Charles",
      "Isaac", "Jacob", "Jamie", "Jason", "Jay", "Kieran", "Lee", "Mark",
      "Martin", "Neil", "Nick", "Paul", "Sean", "Simon", "Steven", "Stuart",
      "Tim", "Tom", "Tony", "Victor", "Wayne", "Zach", "Reggie", "Stanley",
    ],
    last: [
      "Smith", "Jones", "Taylor", "Wilson", "Johnson", "White", "Walker", "Robinson",
      "Wright", "Green", "Hall", "Wood", "Baker", "Clarke", "Cooper", "Ward",
      "Hunt", "Foster", "Bennett", "Grant", "Thompson", "Evans", "Roberts", "Turner",
      "Hill", "Moore", "Clark", "Harris", "Lewis", "Allen", "Young", "King",
      "Scott", "Adams", "Mitchell", "Carter", "Phillips", "Parker", "Collins", "Edwards",
      "Morris", "Murphy", "Cook", "Bailey", "Bell", "Kelly", "Howard", "Marsh",
      "Dawson", "Fletcher", "Simpson", "Hudson", "Barnes", "Chapman", "Gibson", "Harrison",
      "Holmes", "Lawson", "Pearson", "Webster", "Atkinson", "Barker", "Bishop", "Brooks",
      "Burton", "Butler", "Cole", "Cox", "Davies", "Day", "Ellis", "Fisher",
      "Fox", "Freeman", "Graham", "Gray", "Griffiths", "Harper", "Hart", "Hawkins",
      "Hayes", "Holland", "Hopkins", "Hughes", "Jackson", "James", "Jenkins", "Knight",
      "Lane", "Lawrence", "Lee", "Lloyd", "Long", "Lowe", "Mason", "Mills",
      "Morgan", "Palmer", "Payne", "Perry", "Powell", "Price", "Reed", "Reid",
      "Richards", "Russell", "Shaw", "Stone", "Sutton", "Walsh", "Watts", "Wells",
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
      "Pierre", "Francois", "Philippe", "Laurent", "Olivier", "Christophe", "Sebastien", "Damien",
      "Fabien", "Jerome", "Matthieu", "Vincent", "Yann", "Remi", "Thierry", "Alain",
      "Bruno", "Denis", "Eric", "Frederic", "Gregory", "Herve", "Jacques", "Marc",
      "Pascal", "Patrice", "Sylvain", "Xavier", "Yves", "Aurelien", "Bastien", "Corentin",
      "Didier", "Emmanuel", "Fabrice", "Gael", "Hakim", "Ismael", "Jordan", "Loic",
    ],
    last: [
      "Martin", "Bernard", "Dubois", "Durand", "Moreau", "Laurent", "Simon", "Michel",
      "Lefebvre", "Leroy", "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert",
      "Fontaine", "Rousseau", "Vincent", "Faure", "Andre", "Mercier", "Blanc", "Guerin",
      "Boyer", "Garnier", "Chevalier", "Francois", "Legrand", "Gauthier", "Perrin", "Robin",
      "Clement", "Morel", "Henry", "Renard", "Picard", "Marchand", "Traore", "Diallo",
      "Barbier", "Bertrand", "Blanchard", "Caron", "Colin", "Denis", "Deschamps", "Dufour",
      "Dupuis", "Fabre", "Fernandez", "Garcia", "Gautier", "Gerard", "Giraud", "Hubert",
      "Jacquet", "Klein", "Lacroix", "Leclerc", "Lecomte", "Lemoine", "Lopez", "Martinez",
      "Masson", "Meyer", "Morin", "Muller", "Nguyen", "Olivier", "Paris", "Petit",
      "Philippe", "Renaud", "Rey", "Richard", "Robert", "Rodriguez", "Roy", "Schmitt",
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
      "Adriano", "Alan", "Bernardo", "Bruno", "Carlos", "Cesar", "Claudio", "Cleber",
      "Eduardo", "Erick", "Ezequiel", "Fernando", "Francisco", "Guilherme", "Heitor", "Hugo",
      "Isaac", "Jean", "Jonathan", "Jorge", "Jose", "Juliano", "Kevin", "Luis",
      "Manoel", "Marcos", "Mauricio", "Michel", "Miguel", "Nicolas", "Osvaldo", "Patrick",
      "Ricardo", "Roberto", "Rodolfo", "Rogerio", "Silvio", "Tiago", "Victor", "Wagner",
      "Wellington", "William", "Yuri", "Caua", "Renato", "Filipe", "Antonio", "Edson",
    ],
    last: [
      "Silva", "Santos", "Souza", "Oliveira", "Costa", "Pereira", "Ferreira", "Alves",
      "Barbosa", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araujo", "Nascimento", "Rocha",
      "Dias", "Moreira", "Cardoso", "Teixeira", "Correia", "Lima", "Fernandes", "Neves",
      "Almeida", "Azevedo", "Batista", "Borges", "Campos", "Castro", "Cavalcanti", "Duarte",
      "Farias", "Freitas", "Mendes", "Monteiro", "Nogueira", "Pinto", "Ramos", "Vieira",
      "Aguiar", "Amaral", "Andrade", "Antunes", "Assis", "Barros", "Bezerra", "Brito",
      "Caldeira", "Cunha", "Dantas", "Figueiredo", "Franco", "Guimaraes", "Lacerda",
      "Leite", "Machado", "Magalhaes", "Marques", "Medeiros", "Melo", "Miranda", "Mota",
      "Moraes", "Moura", "Nunes", "Paiva", "Peixoto", "Pinheiro", "Reis", "Sales",
      "Santiago", "Siqueira", "Soares", "Torres", "Vargas", "Xavier",
    ],
  },
  Spain: {
    weight: 33,
    first: [
      "Alvaro", "Sergio", "Pablo", "Pedro", "Alejandro", "Marco", "Dani", "Rodrigo",
      "Jesus", "Cesar", "Ivan", "Ruben", "Diego", "Carlos", "Mikel", "Unai",
      "Adrian", "Alberto", "Antonio", "David", "Fernando", "Francisco", "Gonzalo", "Hector",
      "Hugo", "Javier", "Jorge", "Manuel", "Miguel", "Raul",
      "Andres", "Angel", "Asier", "Borja", "Daniel", "Eduardo", "Enrique", "Felix",
      "Gabriel", "Guillermo", "Ignacio", "Ismael", "Jaime", "Jon", "Jose", "Julian",
      "Luis", "Marc", "Mario", "Martin", "Nicolas", "Oscar", "Pau", "Ramon",
      "Ricardo", "Roberto", "Salvador", "Samuel", "Tomas", "Victor", "Xavier", "Yeray",
    ],
    last: [
      "Garcia", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Perez", "Sanchez",
      "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Munoz",
      "Alvarez", "Romero", "Gutierrez", "Alonso", "Navarro", "Dominguez", "Vazquez", "Gil",
      "Serrano", "Molina", "Castro", "Ortega", "Delgado",
      "Aguilar", "Benitez", "Cabrera", "Campos", "Cano", "Carrasco", "Castillo", "Cortes",
      "Crespo", "Domingo", "Duran", "Escudero", "Esteban", "Ferrer", "Flores", "Gallego",
      "Garrido", "Guerrero", "Herrera", "Hidalgo", "Ibanez", "Iglesias", "Leon", "Lozano",
      "Marin", "Medina", "Mendez", "Miranda", "Montero", "Morales", "Nieto", "Ochoa",
      "Pascual", "Pastor", "Pena", "Prieto", "Ramirez", "Ramos", "Reyes", "Rios",
      "Rivera", "Rubio", "Santos", "Sanz", "Soto", "Suarez", "Torres", "Vega",
    ],
  },
  Portugal: {
    weight: 31,
    first: [
      "Joao", "Diogo", "Ruben", "Pedro", "Rafael", "Nuno", "Goncalo", "Vitor",
      "Rui", "Nelson", "Andre", "Jose", "Fabio", "Tiago", "Bruno", "Miguel",
      "Ricardo", "Hugo", "Paulo", "Sergio", "Carlos", "Antonio", "Manuel", "Francisco",
      "Duarte", "Afonso", "Martim", "Tomas", "Vasco", "Simao",
      "Bernardo", "Daniel", "David", "Eduardo", "Filipe", "Guilherme", "Henrique", "Jaime",
      "Jorge", "Leonardo", "Luis", "Marco", "Mario", "Matias", "Renato", "Rodrigo",
      "Samuel", "Xavier", "Armando", "Emanuel", "Felipe", "Gaspar", "Inacio", "Luciano",
    ],
    last: [
      "Silva", "Pereira", "Costa", "Santos", "Ferreira", "Oliveira", "Rodrigues", "Martins",
      "Sousa", "Fonseca", "Goncalves", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro",
      "Pinto", "Carvalho", "Teixeira", "Moreira", "Correia", "Mendes", "Nunes", "Soares",
      "Vieira", "Monteiro", "Cardoso", "Rocha", "Antunes", "Machado",
      "Azevedo", "Barbosa", "Borges", "Campos", "Coelho", "Cunha", "Dias", "Domingues",
      "Duarte", "Faria", "Freitas", "Gomes", "Leite", "Lima", "Lourenco", "Matos",
      "Miranda", "Neves", "Pacheco", "Paiva", "Pinheiro", "Reis", "Sa", "Sequeira",
      "Simoes", "Tavares", "Torres", "Vaz", "Ventura",
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
  Netherlands: {
    weight: 28,
    first: [
      "Daan", "Sem", "Lars", "Thijs", "Bram", "Luuk", "Jesse", "Tim",
      "Niels", "Sven", "Koen", "Ruben", "Stijn", "Joris", "Rick", "Tom",
      "Max", "Thomas", "Jasper", "Wouter", "Bas", "Gijs", "Floris", "Pim",
      "Jelle", "Sander", "Maarten", "Niek", "Teun", "Mees",
      "Arjan", "Bart", "Cas", "Dirk", "Erik", "Frank", "Geert", "Harm",
      "Hendrik", "Jan", "Jeroen", "Joep", "Kevin", "Martijn", "Nick", "Olivier",
      "Pieter", "Rens", "Roan", "Robin", "Ronald", "Stef", "Vincent", "Wesley",
    ],
    last: [
      "de Vries", "Jansen", "van den Berg", "Bakker", "Visser", "Smit", "Meijer", "Mulder",
      "Bos", "Vos", "Peters", "Hendriks", "Dekker", "Brouwer", "van Leeuwen", "de Boer",
      "Kuipers", "Veenstra", "Prins", "Huisman", "van der Meer", "Postma", "Scholten", "Willems",
      "Timmermans", "Verhoeven", "Kok", "Jacobs", "Schouten", "Maas",
      "van Dijk", "van der Wal", "van Wijk", "Vink", "Wolters", "Kramer", "Hoekstra", "Dijkstra",
      "van der Linden", "Groen", "Blom", "Koster", "Peeters", "Sanders", "Martens", "Hermans",
      "van Dam", "Boer", "Vermeer", "Kuiper", "Brink", "Groot", "Smits", "Verbeek",
    ],
  },
  Belgium: {
    weight: 22,
    first: [
      "Lucas", "Arthur", "Noah", "Louis", "Victor", "Jules", "Adam", "Nathan",
      "Thomas", "Maxime", "Simon", "Antoine", "Romain", "Gilles", "Wout", "Senne",
      "Lars", "Milan", "Robbe", "Seppe", "Kobe", "Jarne", "Brent", "Cedric",
      "Bram", "Dries", "Emile", "Fabrice", "Francois", "Gregory", "Hugo", "Jens",
      "Jonas", "Kevin", "Laurent", "Matthias", "Nicolas", "Olivier", "Pieter", "Quentin",
      "Stijn", "Thibault", "Tim", "Vincent", "Yannick",
    ],
    last: [
      "Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens",
      "Wouters", "De Smet", "Vermeulen", "Hermans", "Pauwels", "Michiels", "Aerts", "De Clercq",
      "Dubois", "Lambert", "Dupont", "Leclercq", "Renard", "Denis", "Lemaire", "Segers",
      "Claessens", "De Backer", "De Cock", "Desmet", "Devos", "Dewaele", "Geerts", "Hendrickx",
      "Lejeune", "Martens", "Meeus", "Moens", "Peters", "Stevens", "Thijs", "Van den Bossche",
      "Verstraeten", "Baert", "Cools", "De Vos", "Engels", "Francken", "Leclerc", "Maertens",
    ],
  },
  Argentina: {
    weight: 20,
    first: [
      "Nicolas", "Rodrigo", "Cristian", "Marcos", "German", "Nahuel", "Santiago", "Mateo",
      "Joaquin", "Facundo", "Agustin", "Franco", "Ignacio", "Lucas", "Matias", "Tomas",
      "Bruno", "Gonzalo", "Ezequiel", "Federico", "Leandro", "Maximiliano", "Ramiro", "Valentin",
      "Alejandro", "Andres", "Carlos", "Daniel", "Diego", "Emiliano", "Esteban", "Fabian",
      "Gabriel", "Guillermo", "Hernan", "Javier", "Juan", "Julian", "Lautaro", "Luciano",
      "Martin", "Mauro", "Pablo", "Patricio", "Ricardo", "Sebastian", "Sergio", "Victor",
    ],
    last: [
      "Gonzalez", "Rodriguez", "Gomez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez",
      "Garcia", "Sanchez", "Romero", "Sosa", "Alvarez", "Ruiz", "Ramirez", "Flores",
      "Benitez", "Acosta", "Medina", "Herrera", "Aguirre", "Pereyra", "Dominguez", "Molina",
      "Castro", "Correa", "Ferreyra", "Gimenez", "Gutierrez", "Ibarra", "Ledesma", "Luna",
      "Mansilla", "Morales", "Navarro", "Ortiz", "Peralta", "Rios", "Rojas", "Suarez",
      "Torres", "Vargas", "Vega", "Vera", "Villalba", "Zapata", "Silva", "Mendoza",
    ],
  },
  Scotland: {
    weight: 18,
    first: [
      "Andy", "John", "Scott", "Callum", "Ryan", "Kieran", "Stuart", "Grant",
      "Kenny", "Liam", "Billy", "Robbie", "Nathan", "Aaron", "Lewis", "Fraser",
      "Euan", "Cameron", "Finlay", "Ross",
      "Adam", "Alastair", "Angus", "Blair", "Calum", "Craig", "David", "Douglas",
      "Duncan", "Ewan", "Gavin", "Gregor", "Hamish", "Iain", "James", "Jamie",
      "Keith", "Malcolm", "Mark", "Murray", "Neil", "Rory", "Sean", "Steven",
    ],
    last: [
      "Campbell", "Stewart", "MacDonald", "Murray", "Ross", "Reid", "Gray", "Duncan",
      "Hamilton", "Wallace", "Kerr", "Ferguson", "Grant", "Boyd", "Craig", "Sinclair",
      "Muir", "Bruce", "Douglas", "Burns",
      "Anderson", "Armstrong", "Bell", "Brown", "Clark", "Crawford", "Davidson", "Dickson",
      "Donaldson", "Fraser", "Gordon", "Graham", "Henderson", "Hunter", "Johnston", "Kelly",
      "MacKenzie", "MacLeod", "Marshall", "Mitchell", "Morrison", "Paterson", "Robertson", "Scott",
      "Simpson", "Smith", "Taylor", "Thomson", "Walker", "Watson", "Wilson", "Young",
    ],
  },
  Wales: {
    weight: 16,
    first: [
      "Gareth", "Aaron", "Ben", "Joe", "Daniel", "Ethan", "Harry", "Rhys",
      "Connor", "Dylan", "Owen", "Morgan", "Ieuan", "Osian", "Tomos", "Gethin",
      "Iwan", "Cai", "Steffan", "Elis",
      "Adam", "Alun", "Arwyn", "Bryn", "Carwyn", "Dafydd", "Evan", "Geraint",
      "Gruffudd", "Harri", "Hywel", "Ioan", "Jac", "Llewelyn", "Marc", "Myrddin",
      "Rhodri", "Sion", "Trefor", "Wyn",
    ],
    last: [
      "Davies", "Williams", "Evans", "Thomas", "Roberts", "Hughes", "Morgan", "Griffiths",
      "Owen", "Rees", "Jenkins", "Powell", "Price", "Morris", "Lloyd", "Edwards",
      "Parry", "Pritchard", "Bowen", "Vaughan",
      "Bevan", "Ellis", "Harris", "Hopkins", "James", "Jones",
      "Lewis", "Phillips", "Prosser", "Richards", "Rowlands", "Walters",
      "Watkins", "Wynne", "Anthony", "Baker", "Cooper", "Fisher", "George", "Howells",
    ],
  },
  "Republic of Ireland": {
    weight: 15,
    first: [
      "Sean", "Shane", "Conor", "Josh", "Nathan", "Callum", "Adam", "Jason",
      "Evan", "Cian", "Darragh", "Eoin", "Fionn", "Oisin", "Padraig", "Ronan",
      "Tadhg", "Cathal", "Niall", "Dara",
      "Aaron", "Barry", "Brendan", "Brian", "Ciaran", "Colm", "Damien", "Darren",
      "Declan", "Donal", "Eamon", "Enda", "Gary", "Ian", "Jack", "James",
      "Kevin", "Liam", "Mark", "Martin", "Michael", "Patrick", "Paul", "Peter",
    ],
    last: [
      "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor",
      "O'Neill", "Reilly", "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch",
      "Murray", "Quinn", "Moore", "Nolan",
      "Brennan", "Burke", "Carroll", "Casey", "Clarke", "Collins", "Connolly", "Daly",
      "Dunne", "Farrell", "Fitzgerald", "Flynn", "Graham", "Hayes", "Healy", "Hogan",
      "Keane", "Kearney", "Maher", "McGrath", "McMahon", "Moran", "O'Donnell", "Power",
      "Regan", "Sheridan", "Sweeney", "Whelan",
    ],
  },
  Denmark: {
    weight: 14,
    first: [
      "Mikkel", "Rasmus", "Jonas", "Simon", "Mathias", "Frederik", "Emil", "Oliver",
      "Magnus", "Oscar", "Malthe", "Anders", "Jacob", "Tobias", "Nikolaj", "Soren",
      "Mads", "Kasper", "Lasse", "Gustav",
      "Alexander", "Benjamin", "Christian", "Daniel", "Elias", "Filip", "Henrik", "Jesper",
      "Johan", "Kristian", "Martin", "Morten", "Noah", "Peter", "Sebastian", "Thomas",
      "Victor", "William",
    ],
    last: [
      "Nielsen", "Jensen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sorensen",
      "Rasmussen", "Jorgensen", "Petersen", "Madsen", "Kristensen", "Olsen", "Thomsen", "Christiansen",
      "Poulsen", "Johansen", "Mortensen", "Knudsen",
      "Berg", "Carlsen", "Eriksen", "Frederiksen", "Holm", "Jacobsen", "Kjaer",
      "Lauridsen", "Moller", "Olesen", "Schmidt", "Vestergaard",
    ],
  },
  Germany: {
    weight: 13,
    first: [
      "Lukas", "Finn", "Jonas", "Leon", "Paul", "Felix", "Maximilian", "Jan",
      "Tim", "Niklas", "Fabian", "Florian", "Tobias", "Moritz", "Philipp", "Sebastian",
      "Simon", "David", "Erik", "Hannes",
      "Alexander", "Andreas", "Benjamin", "Christian", "Daniel", "Dominik", "Elias",
      "Franz", "Georg", "Henrik", "Jakob", "Johannes", "Julian", "Kevin", "Lars",
      "Manuel", "Marcel", "Markus", "Martin", "Matthias", "Michael", "Nico", "Oliver",
      "Patrick", "Peter", "Robert", "Stefan", "Thomas", "Tom", "Wolfgang",
    ],
    last: [
      "Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker",
      "Schulz", "Hoffmann", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schroder",
      "Neumann", "Braun", "Zimmermann", "Kruger",
      "Hartmann", "Lange", "Schmitt", "Werner", "Schwarz", "Hofmann", "Ziegler", "Brandt",
      "Kuhn", "Gunther", "Pohl", "Sauer", "Arnold", "Barth", "Busch", "Dietrich",
      "Engel", "Frank", "Fuchs", "Graf", "Haas", "Huber", "Jung", "Keller",
      "Konig", "Lang", "Maier", "Otto", "Peters", "Roth", "Schuster", "Vogel",
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

/**
 * A staging table for nationalities that have a full name pool and a "home
 * league" weight, but are deliberately excluded from NATIONALITIES (and
 * therefore from totalWeight()/pickFromTable's flat, no-homeCountry draw): a
 * nation placed here can only ever be drawn via
 * pickNationality(rng, homeCountry) with that exact homeCountry — never as
 * incidental flavor in another league's roster, and never in the flat pool
 * every existing save's youth intake/free agency already relies on. This
 * keeps adding a new nationality from silently shifting the outcome
 * distribution for saves that have nothing to do with it. Graduate an entry
 * to NATIONALITIES once its home league actually exists in every save it
 * could appear in.
 *
 * Currently empty: Italy lived here while its home league was newer than some
 * saves, and was graduated into NATIONALITIES once every world generated an
 * Italian league — so Italians now appear abroad as ordinary foreign flavor,
 * like Spaniards and Germans. The mechanism is kept for the next such case.
 */
export const UNLISTED_NATIONALITIES: Record<string, NationalityDef> = {};

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
  Kosovo: {
    first: ["Arber", "Besart", "Endrit", "Fisnik", "Granit", "Leart", "Valon", "Blerim"],
    last: ["Krasniqi", "Berisha", "Gashi", "Hoxha", "Shala", "Kastrati", "Morina", "Rexhepi"],
  },
  "Ivory Coast": {
    first: ["Serge", "Yaya", "Wilfried", "Franck", "Cheick", "Ibrahim", "Seydou", "Max"],
    last: ["Kouame", "Toure", "Kone", "Bamba", "Gadji", "Yao", "Coulibaly", "Zoro"],
  },
  Greece: {
    first: ["Giorgos", "Dimitris", "Kostas", "Nikos", "Vasilis", "Panagiotis", "Christos", "Stelios"],
    last: ["Papadopoulos", "Nikolaou", "Georgiou", "Vlachos", "Karatzas", "Samaras", "Fortounis", "Retsos"],
  },
  "Cape Verde": {
    first: ["Nuno", "Ricardo", "Jorge", "Djaniny", "Garry", "Kenny", "Ianique", "Dylan"],
    last: ["Tavares", "Furtado", "Lopes", "Semedo", "Rodrigues", "Fernandes", "Andrade", "Varela"],
  },
  "Guinea-Bissau": {
    first: ["Mama", "Frederic", "Nanu", "Carlos", "Mamadu", "Jorginho", "Bura", "Sori"],
    last: ["Balde", "Mendy", "Embalo", "Cande", "Djalo", "Na Silva", "Indjai", "Camara"],
  },
};

// Sentinel key inside a league weight table standing for the combined
// "Rest of the World" share — when the weighted roll lands here, a nation is
// drawn from that league's tail pool (every nation NOT named in the table),
// weighted by its baseline frequency (see restPoolFor).
const REST = "__REST__";

/**
 * Per-league (home-country) nationality distributions, as relative weights
 * calibrated from real top-flight squad breakdowns (CIES-style). Each named
 * nation's weight is its stated percentage × 10; the REST sentinel's weight
 * is the league's "Rest of the World (Combined)" percentage × 10. Because
 * the source percentages don't sum to exactly 100 (rounding), the realized
 * shares are these weights normalized to the table total — the *relative*
 * proportions are preserved exactly, which is what matters.
 *
 * A club generates and draws youth from its own country's table. The
 * no-homeCountry / unknown-country path (global free agency, and any caller
 * that doesn't know a club's country) falls back to England's table — the
 * same "England-flavored" default the flat pool always was, just recalibrated
 * to the real EPL breakdown.
 *
 * Every named nation here has a name pool in NATIONALITIES or OTHER_NATIONS.
 * Türkiye maps to the existing "Turkey" entry; Kosovo's pool lives in
 * OTHER_NATIONS.
 */
export const LEAGUE_NATIONALITY_WEIGHTS: Record<string, Record<string, number>> = {
  England: {
    England: 394, France: 63, Brazil: 63, Netherlands: 60, Spain: 35, Germany: 30,
    Portugal: 28, Argentina: 25, Belgium: 25, Wales: 23, Italy: 22, Denmark: 22, Scotland: 22,
    [REST]: 210,
  },
  Spain: {
    Spain: 618, Argentina: 39, France: 26, Morocco: 26, Uruguay: 24, Brazil: 21,
    Netherlands: 16, Portugal: 14, Senegal: 10, Cameroon: 10, Nigeria: 10, England: 10,
    Sweden: 8, Germany: 8, Italy: 8, Colombia: 6, Mexico: 6, Japan: 6, Croatia: 6,
    [REST]: 144,
  },
  Italy: {
    Italy: 387, France: 52, Spain: 44, Netherlands: 26, Argentina: 26, Brazil: 23,
    Poland: 22, Croatia: 20, Serbia: 20, Denmark: 19, Sweden: 19, Portugal: 18, Belgium: 18,
    England: 15, Morocco: 15, Germany: 15,
    [REST]: 240,
  },
  Germany: {
    Germany: 440, France: 59, Austria: 52, Denmark: 34, Switzerland: 29, Japan: 27,
    Belgium: 23, "United States": 23, Netherlands: 22, Portugal: 22, Croatia: 20, Brazil: 16,
    Norway: 14, Sweden: 14, Argentina: 13, Italy: 13, Turkey: 13, Nigeria: 13,
    "Czech Republic": 13, Kosovo: 11, England: 11, Algeria: 11, Serbia: 11,
    [REST]: 65,
  },
  // Ligue 1: strong French base, then a Francophone West/North African tail
  // (Senegal/Ivory Coast/Morocco/Mali/Algeria/Cameroon) unique to French
  // football, plus Belgium/Portugal as developmental neighbours.
  France: {
    France: 556, Senegal: 81, "Ivory Coast": 51, Morocco: 42, Belgium: 32, Mali: 32,
    Algeria: 32, Portugal: 32, England: 26, Cameroon: 26, Brazil: 24, Ghana: 24,
    Argentina: 18, Nigeria: 18, Denmark: 16, Switzerland: 16, Netherlands: 14,
    [REST]: 81,
  },
  // Primeira Liga: heavily international but overwhelmingly Brazilian, then
  // Spain and the PALOP (Portuguese-speaking African) nations Angola/Cape
  // Verde/Guinea-Bissau — the league's distinctive cultural pipelines.
  Portugal: {
    Portugal: 448, Brazil: 234, Spain: 99, France: 44, Uruguay: 24, Colombia: 20,
    Greece: 18, Netherlands: 18, Angola: 18, Argentina: 16, Nigeria: 16,
    "Ivory Coast": 16, "Cape Verde": 14, Sweden: 14, "Guinea-Bissau": 14,
    England: 14, Senegal: 14, Morocco: 12,
    [REST]: 72,
  },
};

// Baseline frequency of every nation that has a name pool, used to weight a
// league's "Rest of the World" tail so it stays varied and realistic (a
// common football nation shows up in the tail more than an obscure one)
// rather than uniform. NATIONALITIES nations keep their listed weight;
// OTHER_NATIONS (name-pool-only) nations get a small flat weight.
const OTHER_TAIL_WEIGHT = 3;
const TAIL_BASE: Record<string, number> = (() => {
  const base: Record<string, number> = {};
  for (const [country, def] of Object.entries(NATIONALITIES)) base[country] = def.weight;
  for (const country of Object.keys(OTHER_NATIONS)) base[country] = (base[country] ?? 0) + OTHER_TAIL_WEIGHT;
  return base;
})();

// Per-league memoized derivations of the weight table, so the thousands of
// draws a world generation makes don't re-walk/rebuild these every call.
const leagueTotalCache = new Map<string, number>();
const namedSetCache = new Map<string, Set<string>>();
const restPoolCache = new Map<string, { entries: [string, number][]; total: number }>();

function leagueTotalFor(key: string, table: Record<string, number>): number {
  const cached = leagueTotalCache.get(key);
  if (cached !== undefined) return cached;
  let total = 0;
  for (const w of Object.values(table)) total += w;
  leagueTotalCache.set(key, total);
  return total;
}

function namedSetFor(key: string, table: Record<string, number>): Set<string> {
  const cached = namedSetCache.get(key);
  if (cached) return cached;
  const set = new Set(Object.keys(table).filter((c) => c !== REST));
  namedSetCache.set(key, set);
  return set;
}

// The tail pool for a league: every name-pool-bearing nation NOT already
// named in that league's table, weighted by its TAIL_BASE frequency.
function restPoolFor(key: string, named: Set<string>) {
  const cached = restPoolCache.get(key);
  if (cached) return cached;
  const entries: [string, number][] = [];
  let total = 0;
  for (const [country, w] of Object.entries(TAIL_BASE)) {
    if (named.has(country)) continue;
    entries.push([country, w]);
    total += w;
  }
  const built = { entries, total };
  restPoolCache.set(key, built);
  return built;
}

/**
 * Weighted-random nationality draw for a league. `homeCountry` selects that
 * country's real-calibrated distribution (see LEAGUE_NATIONALITY_WEIGHTS);
 * a missing or unrecognized country falls back to England's table — the
 * England-flavored default the global free-agency / no-country pool has
 * always used. When the roll lands in the combined "Rest of the World" slot,
 * a second weighted roll picks from that league's tail of all other nations.
 */
export function pickNationality(rng: () => number, homeCountry?: string): string {
  const key = homeCountry && LEAGUE_NATIONALITY_WEIGHTS[homeCountry] ? homeCountry : "England";
  const table = LEAGUE_NATIONALITY_WEIGHTS[key];
  const total = leagueTotalFor(key, table);

  let roll = rng() * total;
  for (const [country, w] of Object.entries(table)) {
    if (roll < w) {
      if (country !== REST) return country;
      const { entries, total: restTotal } = restPoolFor(key, namedSetFor(key, table));
      let restRoll = rng() * restTotal;
      for (const [tailCountry, tw] of entries) {
        if (restRoll < tw) return tailCountry;
        restRoll -= tw;
      }
      return entries[entries.length - 1][0];
    }
    roll -= w;
  }
  // Roll should always be consumed above; fall back to the home nation.
  return key;
}

export function namePoolFor(nationality: string): { first: string[]; last: string[] } | undefined {
  return NATIONALITIES[nationality] ?? OTHER_NATIONS[nationality] ?? UNLISTED_NATIONALITIES[nationality];
}
