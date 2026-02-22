// ========================================
// LOVECHAT - BACKEND COM MYSQL
// ========================================

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ========================================
// CONEXÃO COM MYSQL (filess.io)
// ========================================
const db = mysql.createConnection({
    host: '5s5v57.h.filess.io',
    user: 'SEU_USUARIO_AQUI',        // Substitua pelo seu usuário
    password: 'SUA_SENHA_AQUI',       // Substitua pela sua senha
    database: 'SEU_BANCO_AQUI',       // Substitua pelo nome do banco
    port: 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Conectar ao banco
db.connect((err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao MySQL:', err);
        return;
    }
    console.log('✅ Conectado ao MySQL com sucesso!');
    
    // Criar tabelas se não existirem
    criarTabelas();
});

// Função para criar tabelas
function criarTabelas() {
    const queries = [
        `CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            senha VARCHAR(255) NOT NULL,
            foto LONGTEXT,
            score INT DEFAULT 0,
            online BOOLEAN DEFAULT FALSE,
            ultimo_acesso DATETIME,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS mensagens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            usuario_id INT NOT NULL,
            usuario_nome VARCHAR(100) NOT NULL,
            usuario_foto LONGTEXT,
            tipo ENUM('text', 'image', 'video', 'audio') NOT NULL,
            conteudo LONGTEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`,
        
        `CREATE TABLE IF NOT EXISTS scores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            usuario_id INT NOT NULL,
            de_usuario_id INT NOT NULL,
            pontos INT NOT NULL,
            motivo VARCHAR(255),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY (de_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )`
    ];
    
    queries.forEach(query => {
        db.query(query, (err) => {
            if (err) console.error('Erro ao criar tabela:', err);
        });
    });
    
    console.log('✅ Tabelas verificadas/criadas');
    
    // Inserir usuário de teste se não existir
    inserirUsuarioTeste();
}

// Inserir usuário de teste
function inserirUsuarioTeste() {
    const usuariosTeste = [
        ['Usuário Teste', 'teste@email.com', '123456', 'https://via.placeholder.com/150/667eea/ffffff?text=Teste'],
        ['Crush', 'crush@email.com', '123456', 'https://via.placeholder.com/150/764ba2/ffffff?text=Crush']
    ];
    
    usuariosTeste.forEach(([nome, email, senha, foto]) => {
        db.query(
            'INSERT IGNORE INTO usuarios (nome, email, senha, foto) VALUES (?, ?, ?, ?)',
            [nome, email, senha, foto],
            (err) => {
                if (err) console.error('Erro ao inserir usuário de teste:', err);
            }
        );
    });
}

// ========================================
// ROTAS DA API
// ========================================

// ----- TESTE -----
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 LoveChat Backend funcionando!',
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

// ----- USUÁRIOS -----

// Login
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ success: false, message: 'Email e senha obrigatórios' });
    }
    
    db.query(
        'SELECT * FROM usuarios WHERE email = ? AND senha = ?',
        [email, senha],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            
            if (results.length > 0) {
                const user = results[0];
                delete user.senha; // Remover senha do retorno
                
                // Atualizar status online
                db.query(
                    'UPDATE usuarios SET online = true, ultimo_acesso = NOW() WHERE id = ?',
                    [user.id]
                );
                
                res.json({ success: true, user });
            } else {
                res.json({ success: false, message: 'Email ou senha incorretos' });
            }
        }
    );
});

// Buscar todos os usuários
app.get('/api/usuarios', (req, res) => {
    db.query(
        'SELECT id, nome, email, foto, score, online, ultimo_acesso FROM usuarios',
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            res.json(results);
        }
    );
});

// Buscar usuário por ID
app.get('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    
    db.query(
        'SELECT id, nome, email, foto, score, online, ultimo_acesso FROM usuarios WHERE id = ?',
        [id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            
            if (results.length > 0) {
                res.json(results[0]);
            } else {
                res.status(404).json({ success: false, message: 'Usuário não encontrado' });
            }
        }
    );
});

// Atualizar usuário
app.put('/api/usuarios/:id', (req, res) => {
    const { id } = req.params;
    const { nome, foto, online, score, ultimo_acesso } = req.body;
    
    let query = 'UPDATE usuarios SET ';
    const values = [];
    const updates = [];
    
    if (nome) { updates.push('nome = ?'); values.push(nome); }
    if (foto) { updates.push('foto = ?'); values.push(foto); }
    if (online !== undefined) { updates.push('online = ?'); values.push(online); }
    if (score !== undefined) { updates.push('score = ?'); values.push(score); }
    if (ultimo_acesso) { updates.push('ultimo_acesso = ?'); values.push(ultimo_acesso); }
    
    if (updates.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum dado para atualizar' });
    }
    
    query += updates.join(', ') + ' WHERE id = ?';
    values.push(id);
    
    db.query(query, values, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Erro no servidor' });
        }
        res.json({ success: true });
    });
});

// Registrar novo usuário
app.post('/api/registrar', (req, res) => {
    const { nome, email, senha, foto } = req.body;
    
    if (!nome || !email || !senha) {
        return res.status(400).json({ success: false, message: 'Nome, email e senha obrigatórios' });
    }
    
    // Verificar se email já existe
    db.query('SELECT id FROM usuarios WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Erro no servidor' });
        }
        
        if (results.length > 0) {
            return res.json({ success: false, message: 'Email já cadastrado' });
        }
        
        // Inserir novo usuário
        const fotoPadrao = foto || `https://via.placeholder.com/150/${Math.floor(Math.random()*16777215).toString(16)}/ffffff?text=${nome.charAt(0)}`;
        
        db.query(
            'INSERT INTO usuarios (nome, email, senha, foto) VALUES (?, ?, ?, ?)',
            [nome, email, senha, fotoPadrao],
            (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Erro no servidor' });
                }
                
                res.json({ 
                    success: true, 
                    message: 'Usuário criado com sucesso',
                    id: result.insertId 
                });
            }
        );
    });
});

// ----- MENSAGENS -----

// Buscar mensagens
app.get('/api/mensagens', (req, res) => {
    const limite = req.query.limite || 100;
    
    db.query(
        'SELECT * FROM mensagens ORDER BY timestamp DESC LIMIT ?',
        [parseInt(limite)],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            res.json(results.reverse());
        }
    );
});

// Buscar mensagens desde um ID
app.get('/api/mensagens/novas/:ultimoId', (req, res) => {
    const { ultimoId } = req.params;
    
    db.query(
        'SELECT * FROM mensagens WHERE id > ? ORDER BY timestamp',
        [ultimoId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            res.json(results);
        }
    );
});

// Enviar mensagem
app.post('/api/mensagens', (req, res) => {
    const { usuario_id, usuario_nome, usuario_foto, tipo, conteudo } = req.body;
    
    if (!usuario_id || !usuario_nome || !tipo || !conteudo) {
        return res.status(400).json({ success: false, message: 'Dados incompletos' });
    }
    
    db.query(
        'INSERT INTO mensagens (usuario_id, usuario_nome, usuario_foto, tipo, conteudo) VALUES (?, ?, ?, ?, ?)',
        [usuario_id, usuario_nome, usuario_foto, tipo, conteudo],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            
            // Buscar a mensagem inserida
            db.query(
                'SELECT * FROM mensagens WHERE id = ?',
                [result.insertId],
                (err, results) => {
                    if (err) {
                        return res.json({ success: true, id: result.insertId });
                    }
                    res.json({ success: true, message: results[0] });
                }
            );
        }
    );
});

// ----- PONTUAÇÕES -----

// Adicionar pontuação
app.post('/api/scores', (req, res) => {
    const { usuario_id, de_usuario_id, pontos, motivo } = req.body;
    
    if (!usuario_id || !de_usuario_id || !pontos) {
        return res.status(400).json({ success: false, message: 'Dados incompletos' });
    }
    
    // Inserir score
    db.query(
        'INSERT INTO scores (usuario_id, de_usuario_id, pontos, motivo) VALUES (?, ?, ?, ?)',
        [usuario_id, de_usuario_id, pontos, motivo || ''],
        (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            
            // Atualizar score do usuário
            db.query(
                'UPDATE usuarios SET score = score + ? WHERE id = ?',
                [pontos, usuario_id],
                (err) => {
                    if (err) {
                        console.error(err);
                        return res.json({ success: true, warning: 'Score registrado mas não atualizado' });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

// Buscar ranking
app.get('/api/ranking', (req, res) => {
    db.query(
        'SELECT id, nome, foto, score FROM usuarios ORDER BY score DESC',
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            res.json(results);
        }
    );
});

// Buscar pontuações de um usuário
app.get('/api/scores/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;
    
    db.query(
        'SELECT s.*, u.nome as de_nome FROM scores s JOIN usuarios u ON s.de_usuario_id = u.id WHERE s.usuario_id = ? ORDER BY s.timestamp DESC',
        [usuarioId],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ success: false, message: 'Erro no servidor' });
            }
            res.json(results);
        }
    );
});

// ========================================
// INICIAR SERVIDOR
// ========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`🔌 API disponível em http://localhost:${PORT}/api`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não capturado:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promise rejeitada não tratada:', err);
});
