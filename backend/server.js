const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(express.json());

// VARIÁVEL GLOBAL PARA A CONEXÃO
let db;

function conectarBanco() {
    db = mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "natacao",
        port: process.env.DB_PORT || 3306,
        ssl: process.env.DB_HOST ? { rejectUnauthorized: false } : null
    });

    db.connect((erro) => {
        if (erro) {
            console.log("Erro ao conectar, tentando novamente em 5 segundos...", erro.message);
            setTimeout(conectarBanco, 5000);
            return;
        }
        console.log("Conectado com sucesso ao MySQL!");

        // CRIAÇÃO DA TABELA (Garante que a tabela exista sempre que o banco ligar)
        const criarTabelaSQL = `
            CREATE TABLE IF NOT EXISTS alunos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                idade INT NOT NULL,
                nivel VARCHAR(100) NOT NULL,
                horario VARCHAR(100) NOT NULL,
                ativo TINYINT(1) DEFAULT 1
            ) ENGINE=InnoDB;
        `; // O 'ENGINE=InnoDB' força o MySQL a salvar os dados no disco de forma persistente!
        
        db.query(criarTabelaSQL, (erroTabela) => {
            if (erroTabela) console.log("Erro ao criar tabela:", erroTabela);
            else console.log("Tabela 'alunos' pronta e persistente no disco!");
        });
    });

    // SE O BANCO CAIR NO MEIO DA EXECUÇÃO, RECONECTA SOZINHO
    db.on("error", (erro) => {
        console.log("Banco desconectado de repente:", erro.code);
        if (erro.code === "PROTOCOL_CONNECTION_LOST" || erro.code === "ECONNRESET") {
            conectarBanco();
        } else {
            throw erro;
        }
    });
}

// INICIA A CONEXÃO
conectarBanco();

app.get("/", (req, res) => {
    res.json({ mensagem: "API funcionando" });
});

app.post("/alunos", (req, res) => {
    const { nome, idade, nivel, horario } = req.body;

    if (!nome || !idade || !nivel || !horario) {
        return res.status(400).json({ erro: "Preencha todos os campos." });
    }
    if (idade < 5) {
        return res.status(400).json({ erro: "Aluno abaixo da idade permitida." });
    }

    const verificaSQL = "SELECT * FROM alunos WHERE nome = ?";
    db.query(verificaSQL, [nome], (erro, resultado) => {
        if (erro) return res.status(500).json(erro);
        if (resultado.length > 0) {
            return res.status(400).json({ erro: "Já existe este nome cadastrado no banco" });
        }
        
        const inserirSQL = `INSERT INTO alunos (nome, idade, nivel, horario) VALUES (?, ?, ?, ?)`;
        db.query(inserirSQL, [nome, idade, nivel, horario], (erro, resultado) => {
            if (erro) return res.status(500).json(erro);
            res.status(201).json({
                mensagem: "Aluno cadastrado",
                id: resultado.insertId
            });
        });
    });
});

app.get("/alunos", (req, res) => {
    db.query("SELECT * FROM alunos", (erro, resultado) => {
        if (erro) return res.status(500).json(erro);
        res.json(resultado);
    });
});

app.delete("/alunos/:id", (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM alunos WHERE id = ?", [id], (erro, resultado) => {
        if (erro) return res.status(500).json(erro);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ erro: "Aluno não encontrado" });
        }
        res.json({ mensagem: "Aluno removido" });
    });
});

app.put("/alunos/:id", (req, res) => {
    const id = req.params.id;
    db.query("SELECT ativo FROM alunos WHERE id = ?", [id], (erro, resultado) => {
        if (erro) return res.status(500).json(erro);
        if (resultado.length === 0) {
            return res.status(404).json({ erro: "Aluno não encontrado" });
        }
        const novoStatus = resultado[0].ativo ? 0 : 1;

        db.query("UPDATE alunos SET ativo = ? WHERE id = ?", [novoStatus, id], (erro) => {
            if (erro) return res.status(500).json(erro);
            res.json({ mensagem: "Aluno atualizado" });
        });
    });
});

let incorretas = 0;
let bloqueado = false;

app.post("/admin", (req, res) => {
    const { senha } = req.body;

    if (bloqueado === true) {
        return res.status(403).json({ erro: "Tentativas excedentes. Sistema bloqueado." });
    }
    if (!senha) {
        return res.status(400).json({ erro: "informe a senha." });
    }
    if (senha === "admin123") {
        incorretas = 0;
        return res.json({ autenticado: true });
    }
    incorretas++;
    if (incorretas >= 3) {
        bloqueado = true;
        return res.status(403).json({ erro: "Sistema bloqueado" });
    }
    return res.status(401).json({
        erro: `Senha incorreta. Faltam ${3 - incorretas} até o bloqueio do sistema.`
    });
});

// O Render injeta dinamicamente a porta na variável process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});