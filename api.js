const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();

app.use(cors());
app.use(express.json());

const sequelize = new Sequelize('edge_chajian', 'hxc', '123456', {
  host: '8.141.2.17',
  port: 3306,
  dialect: 'mysql'
});

// 定义模型
const MoehuPic = sequelize.define('moehu_pic', {
  src: {
    type: DataTypes.STRING,
    allowNull: false    // 非空约束
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'moehu_pic',
  timestamps: false
});

// 定义模型
const CatPic = sequelize.define('cat_pic', {
  src: {
    type: DataTypes.STRING,
    allowNull: false    // 非空约束
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'cat_pic',
  timestamps: false
});

// 定义DogPic模型
const DogPic = sequelize.define('dog_pic', {
  src: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'dog_pic',
  timestamps: false
});

// 模型映射
const models = {
  moehu_pic: MoehuPic,
  cat_pic: CatPic,
  dog_pic: DogPic
  // 可以在这里添加更多的模型
};

// 通过外部API获取图片，并存入数据库
app.get('/fetch-image', async function (req, res) {
  const imageUrl = 'https://img.moehu.org/pic.php?id=katoumegumi&size&return=json&num=10';

  try {
    // 获取图片URL
    const response = await axios.get(imageUrl);
    const data = response.data;

    if (data.code !== '200') {
      return res.status(500).json({ msg: 'Failed to fetch images' });
    }

    const pic = data.pic;

    for (const url of pic) {
      // 将图片URL存入数据库
      await MoehuPic.create({ src: url, type: 'katoumegumi' });
    }

    res.json({ msg: 'Image URLs saved successfully' });
  } catch (error) {
    console.error('Error fetching image URLs:', error);
    res.status(500).json({ msg: error.message });
  }
});

// API路由处理
app.get('/fetch-image2', async function (req, res) {
  const imageUrl = 'https://api.thecatapi.com/v1/images/search'; // 假设这是你新的API URL

  try {
    // 获取图片URL
    const response = await axios.get(imageUrl);
    const data = response.data;

    // 检查响应数据是否符合预期
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(500).json({ msg: 'Failed to fetch images' });
    }

    // 遍历每个图片对象
    for (const item of data) {
      // 将图片URL存入数据库
      await CatPic.create({ src: item.url, type: 'cat' });
    }

    res.json({ msg: 'Image URLs saved successfully' });
  } catch (error) {
    console.error('Error fetching image URLs:', error);
    res.status(500).json({ msg: error.message });
  }
});

// 获取狗狗图片API
app.get('/fetch-image3', async function (req, res) {
  const imageUrl = 'https://dog.ceo/api/breeds/image/random';

  try {
    // 获取图片URL
    const response = await axios.get(imageUrl);
    const data = response.data;

    // 检查响应数据是否符合预期
    if (data.status !== 'success') {
      return res.status(500).json({ msg: 'Failed to fetch dog image' });
    }

    // 将图片URL存入数据库
    await DogPic.create({ src: data.message, type: 'dog' });

    res.json({ msg: 'Dog image URL saved successfully' });
  } catch (error) {
    console.error('Error fetching dog image:', error);
    res.status(500).json({ msg: error.message });
  }
});

// 获取图片数据
app.get('/images', async function (req, res) {
  const type = req.query.type;
  const page = parseInt(req.query.page) || 1; // 默认第一页
  const size = parseInt(req.query.size) || 10; // 默认每页10条数据
  const src = req.query.src;

  if (!src) {
    return res.status(400).json({ msg: 'Src parameter is required' });
  }

  if (!type) {
    return res.status(400).json({ msg: 'Type parameter is required' });
  }

  const Model = models[src];
  if (!Model) {
    return res.status(400).json({ msg: 'Invalid src parameter' });
  }

  const offset = (page - 1) * size;

  try {
    // 获取图片数据
    const rows = await Model.findAll({
      where: { type },
      limit: size,
      offset: offset
    });

    res.json(rows);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ msg: error.message });
  }
});

// 添加历史记录
app.post('/api/history', async function (req, res) {
  const { src } = req.body;

  if (!src) {
    return res.status(400).json({ msg: 'Src parameter is required' });
  }

  try {
    // 检查图片是否已经存在
    const [existing] = await sequelize.query('SELECT * FROM history WHERE src = ?', {
      replacements: [src]
    });

    if (existing.length > 0) {
      return res.status(200).json({ msg: 'Image already exists in history' });
    }

    // 如果不存在，则插入新记录
    await sequelize.query('INSERT INTO history (src) VALUES (?)', {
      replacements: [src]
    });

    res.status(201).json({ msg: 'History added successfully' });
  } catch (error) {
    console.error('Error adding history:', error);
    res.status(500).json({ msg: error.message });
  }
});

// 获取历史记录
app.get('/api/history', async function (req, res) {
  const page = parseInt(req.query.page) || 1; // 默认第一页
  const size = parseInt(req.query.size) || 10; // 默认每页10条数据
  const offset = (page - 1) * size;

  try {
    // 获取总记录数
    const [countResult] = await sequelize.query('SELECT COUNT(*) AS total FROM history');
    const total = countResult[0].total;

    // 获取分页数据
    const [rows] = await sequelize.query('SELECT * FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?', {
      replacements: [size, offset]
    });

    res.json({
      total, // 总记录数
      page,  // 当前页码
      size,  // 每页记录数
      data: rows // 当前页的数据
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ msg: error.message });
  }
});

const server = app.listen(8080, 'localhost', function () {
  const host = server.address().address;
  const port = server.address().port;
  console.log("Running server at http://%s:%s", host, port);
});

// 验证数据库连接
sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    process.exit(1);
  });
