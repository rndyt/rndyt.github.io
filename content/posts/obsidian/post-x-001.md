---
title: 自顶向下的大语言模型基础介绍
description: 现代 Agent 的核心驱动力，始终来源于大语言模型，Harness 的核心，始终是围绕 LLM API 构建的一套控制循环。
date: 2026-09-25
author: rndyt
tags:
  - LLM
  - Agent
preview: false
kind: article
category: AI 实践
archiveId: X-001
slug: post-x-001
---

现代 Agent 的核心驱动力，始终来源于大语言模型，Harness 的核心，始终是围绕 LLM API 构建的一套控制循环。

本文将从典型的 LLM API 出发，自顶向下地梳理这个正在影响人类世界的大语言模型的结构和原理。

``` http
POST /v1/responses
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "gpt-5.6",
  "input": "什么是 Transformer？"
}
```

这是一个最基本的 Responses API 格式的请求，只有两个字段，model 用于指定调用的模型，input 则是你要交给模型的输入。

事实上，这里的输入并不会就这样直接地交给 LLM，对于 Responses API 的 input 来说，其不只可以接受普通字符串，也可以接受结构化的消息数组。所以输入首先会通过标准化，被规范为模型服务内部统一的消息表示。也就是说，用户直接传入的一段字符串，会被补充上消息角色、内容类型等结构化信息，从而转换成如下所示的统一消息表示。

```json
[
  {
    "role": "user",
    "content": [
      {
        "type": "input_text",
        "text": "什么是 Transformer？"
      }
    ]
  },
  {
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "Transformer 是一种基于注意力机制的神经网络架构……"
      }
    ]
  },
  {
    "role": "user",
    "content": [
      {
        "type": "input_text",
        "text": "那 Self-Attention 又是什么？"
      }
    ]
  }
]
```

不过这种结构仍然不能直接作为大语言模型的输入，它还需要经过 Chat Template 的处理。

# Chat Template

当代大语言模型大多采用 Decoder-only Transformer 作为核心架构，其基本目标是**基于已有上下文预测并生成下一个 Token**。

而在实际调用大语言模型时，我们经常会以问题或指令的形式提供输入。那么，一个本质上只负责“预测下一个 Token”的 Decoder-only Transformer，为什么不会继续补全新的问题，或者对指令本身进行续写呢？关键就在于 Chat Template。示例的消息经过 Chat Template 处理后，可能会呈现为下面的形式：

```
<|im_start|>user
什么是 Transformer？<|im_end|>
<|im_start|>assistant
```

这里采用的是一种典型的 ChatML 风格表示。其中，`<|im_start|>` 和 `<|im_end|>` 用于标记一条消息的开始与结束，`user` 和 `assistant` 则用于区分消息所属的角色。最后出现的 `<|im_start|>assistant` 表示用户消息已经结束，接下来进入 Assistant 的回答阶段。

这套对话格式在模型的指令微调和训练阶段会被大量使用，所以模型学习到了这些标记的语义，当模型开始预测下一个 token 时，其概率最高的后续内容就会是对用户问题的回答。

不过，到这里得到的仍然是由文本和特殊标记组成的字符序列，大语言模型最终是运行在数字计算硬件之上，因此自然语言输入需要被转换为数值形式。

# Tokenizer（分词器）

分词器的作用就是将字符序列切分为多个基本单元，并将每个基本单元映射为一个整数编号，这一基本单元就叫做词元（Token），其对应的数值则称为 Token ID，这套映射集合就是词表（Vocabulary），其作用可以类比为一本用于连接文本符号与数字编号的“字典”。

一种最直观的方法，是将每一个字符都作为独立的 Token，并为其分配一个 Token ID。但单个字符通常只能承载有限的信息，一段文本会因此被拆分成更长的 Token 序列。模型需要通过更多层的上下文计算才能逐渐组合出词语和更高层次的语义，同时也会增加序列长度和计算开销。

另一个极端是直接将每一个完整单词都作为一个 Token。这样虽然可以减少常见词所占用的 Token 数量，但自然语言中的词汇数量非常庞大，而且还会不断出现新词。如果全部加入词表，会导致词表规模迅速膨胀，且没有出现在词表中的词无法被模型处理。

因此，现代大语言模型通常采用**子词分词（Subword Tokenization）**。它的核心思想是在“字符”和“完整单词”之间寻找平衡：高频出现的字符组合或单词可以作为完整 Token 保留下来，而低频或未见过的词则可以进一步拆分成更小的子词、字符甚至字节单元。

例如：

```text
playing
```

可能被切分为：

```text
["play", "ing"]
```

这样既能够用较少的 Token 表示常见内容，又能够通过已有的基本单元组合出训练时没有完整见过的新词。

以字节对编码（Byte-Pair Encoding, BPE）为例，其核心思路可以理解为以下过程：
1. 初始化：将所有语料库中出现的基本字符放入词表
2. 迭代合并：统计语料库中所有相邻词元对的出现频率，将出现频率最高的一对合并为一个新的词元放入词表
3. 重复：重复第二步，直到词表达到预设的大小。

假设我们的语料库为`{"cat": 3, "car": 2, "cap": 1, "bat": 1}`，目标词表大小为10，那么合并过程如下表所示：

| 步骤   | 最高频词元对  |  频率 | 合并为   | 新增词元                 | 词表大小 |
| ---- | ------- | --: | ----- | -------------------- | ---: |
| 初始化  | -       |   - | -     | `{c, a, t, r, p, b}` |    6 |
| 合并 1 | `c, a`  |   6 | `ca`  | `ca`                 |    7 |
| 合并 2 | `ca, t` |   3 | `cat` | `cat`                |    8 |
| 合并 3 | `ca, r` |   2 | `car` | `car`                |    9 |
| 合并 4 | `ca, p` |   1 | `cap` | `cap`                |   10 |

最后的完整词表为：`{ c, a, t, r, p, b, ca, cat, car, cap }`

不同的模型或模型家族通常会有自己配套的分词器和词表，它们在模型训练阶段就会与模型参数绑定，因此是不能随意替换的。同时，模型分词器和词表的区别也会影响到模型的性能表现。

上述介绍的是词表在训练阶段被构建出来的过程，当训练好的模型接受到一段文本时，就会使用已经训练好的词表将输入的文本编码为 Token ID 序列。最终分词器输出的的是一串整数序列，如下所示。

```text
[40, 716, 1512, 287, 6243, 13]
```

# Token Embedding

Token ID 的本质是词表中的索引编号，其并不包含任何的语义信息，因此还需要 Embedding 层将离散的 Token ID 序列转换为可以包含语义信息的高维向量。

Token Embedding 的主流实现方式就是查表，在模型预训练阶段，会训练一个大小为（词表大小，嵌入维度）的参数矩阵，每一行就对应词表中一个 Token 的向量表示，这样我们就将一个整数序列转换为了一个二维矩阵。

在实际实践中，为了提高 GPU 的计算效率和吞吐量，会将相互独立的多条文本组合为一个 Batch 进行计算，所以最终输出的会是一个三维张量。

# Transformer

经过 Token Embedding 后，输入的 Token ID 序列已经被转换为高维向量表示，接下来这些向量将进入 Transformer 网络进行计算。

不过，在进一步介绍 Transformer 的内部结构之前，我们需要先了解大语言模型在实际推理时的运行方式。对于现代 Decoder-only LLM，一次完整的推理通常可以划分为两个阶段：**Prefill（预填充）和 Decode（解码生成）**，两者是同一个 Transformer 模型在不同推理阶段的两种计算方式。

接下来，我们会先介绍 Transformer Block 的内部结构，了解模型如何通过 Self-Attention 和前馈神经网络处理 Token 向量，再讨论 Prefill 和 Decode 的区别。

## Transformer Block

Transformer Block 是 Transformer 神经网络中可重复堆叠的基本计算单元。一个现代 Decoder-only LLM 通常由多个 Transformer Block 组成，每一层接收上一层输出的隐藏状态，通过 Self-Attention 和前馈神经网络对其进行处理，并将更新后的隐藏状态传递给下一层。

经过 Token Embedding 后，我们已经得到一个形状为 $[B,L,D]$ 的三维张量，其中 $B$ 表示 Batch Size，$L$ 表示序列长度，$D$ 表示隐藏维度。这个张量也可以称为初始隐藏状态（Hidden States）。随着隐藏状态不断经过 Transformer Block，其向量表示也会不断更新，从而逐渐融合上下文信息。

一个典型的现代 Transformer Block 主要包含归一化（Normalization）、自注意力机制（Self-Attention）、前馈神经网络（FFN）以及残差连接（Residual Connection）。

### 归一化

在进入 Self-Attention 之前，现代 LLM 通常会先对输入隐藏状态进行归一化处理。由于 Transformer Block 中的矩阵运算和残差连接可能不断改变隐藏向量的数值尺度，如果缺少适当的控制，就可能影响后续计算的数值稳定性。

归一化的主要作用就是调整隐藏向量的数值尺度，使其保持在相对稳定的范围内，从而改善模型的训练稳定性。现代 LLM 常采用 RMSNorm 等方法进行处理。

## 自注意力机制

Self-Attention 的核心作用，是让序列中的每个 Token 根据当前上下文，从其他可以关注的 Token 中提取信息，并更新自身的向量表示。

### QKV

Self-Attention 首先会对输入隐藏状态进行三组线性投影，生成 Query、Key、Value 三种向量。

$$  
Q=XW_Q,\quad K=XW_K,\quad V=XW_V  
$$

这里的 $X$ 表示进入 Attention 线性投影的隐藏状态，$W_Q$、$W_K$、$W_V$ 则是模型训练得到的参数矩阵。

三个向量分别承担不同的作用：

| 名称       | 含义                         |
| -------- | -------------------------- |
| Query（Q） | 当前 Token 用于寻找相关信息的查询特征     |
| Key（K）   | 当前 Token 用于被其他 Token 匹配的特征 |
| Value（V） | 当前 Token 可以提供给其他 Token 的信息 |
### 位置编码

在计算 Attention 时，模型不仅需要判断 Token 之间的关联程度，还需要知道它们在序列中的位置关系。例如，“我喜欢苹果”和“苹果喜欢我”包含相同的 Token，但排列顺序不同，表达的含义也完全不同。因此，模型需要通过位置编码引入 Token 的位置信息。

现代 LLM 通常采用 RoPE（Rotary Position Embedding，旋转位置编码）。它的核心思路是：**根据每个 Token 在序列中的位置，对其 Query 和 Key 向量进行不同角度的旋转。**

由于旋转角度与 Token 的位置有关，当两个 Token 的 Query 和 Key 计算点积时，旋转角度之间的差异就能够反映它们的相对位置。

这样，Attention 在计算 Token 之间的关联程度时，就能够同时考虑 Token 的内容信息和相对位置关系，而不只是比较它们的向量特征。

### Attention Score

得到 Q、K、V 后，模型就可以利用它们计算 Token 之间的关联程度，并根据关联程度聚合上下文信息。这一过程就是 Self-Attention 的核心计算。为了便于理解，我们先只考虑一组 Q、K、V 的情况，也就是一次独立的注意力计算。

模型首先通过 Query 和 Key 的点积计算注意力分数，用于衡量当前 Token 与其他 Token 的匹配程度：

$$  
S=QK^T  
$$

对于包含 $L$ 个 Token 的序列，计算得到的注意力分数矩阵大小为 $L\times L$。其中，每一行代表一个发起查询的 Token，每一列代表一个被查询的 Token，矩阵中的数值则表示对应 Token 之间的匹配分数。

不过，当 Query 和 Key 的维度较大时，点积结果的数值幅度也可能随之增大，从而影响后续 Softmax 的计算。因此，模型通常还会将点积结果除以 Key 向量维度的平方根：

$$  
S=\frac{QK^T}{\sqrt{d_k}}  
$$

这种计算方式称为 Scaled Dot-Product Attention（缩放点积注意力）。

以上介绍了通过一组 Q、K、V 完成 Self-Attention 计算的过程，但自然语言中的 Token 往往存在多种不同的关联关系。如果只进行一次注意力计算，模型能够提取的信息模式可能受到限制。因此，Transformer 引入了 Multi-Head Attention（多头注意力机制），其核心思路是：**使用多组不同的 Q、K、V 投影，并行执行多次注意力计算，每一组独立的注意力计算就称为一个 Attention Head（注意力头）。** 由于不同 Attention Head 拥有各自的投影参数，它们可以从不同的特征子空间学习 Token 之间的关联关系。例如，一些 Head 可能更关注相邻 Token 之间的联系，而另一些则可能更关注距离较远的上下文信息。这些关注模式并非人为指定，而是在模型训练过程中逐渐形成的。

在实际计算中，模型并不需要为每个 Attention Head 分别执行一次线性投影，而是可以先通过大型投影矩阵，一次性生成所有 Head 所需的 Q、K、V 向量。

例如，假设隐藏向量的维度为 4096，模型使用 32 个 Attention Head。那么，模型可以先通过线性投影生成 4096 维的 Q、K、V 向量，再将每个向量划分为 32 组，每组包含 128 个维度。这样，每个 Head 都能获得属于自己的一组 Q、K、V，并独立完成前面介绍的 Attention 计算。由于不同 Head 的投影参数不同，它们能够从不同的特征空间提取上下文信息。最后，模型将 32 个 Head 的输出重新拼接为一个 4096 维向量，再经过一次线性变换（这里用到的变换矩阵也是通过训练学习出来的），得到 Multi-Head Attention 的最终输出。

经过 Attention Score 计算后每个 Token得到的是一组与其他 Token 的匹配分数，模型还需要通过 Softmax 进行处理。Softmax 的作用是将一组任意大小的数值转换为概率分布，使所有输出值都处于 0 到 1 之间，且总和为 1。 会保留原始数值之间的大小顺序，同时通过指数运算，使较大的数值获得更高的概率，其公式为：

$$  
P_i=\frac{e^{z_i}}{\sum_j e^{z_j}}
$$

其中，$z_i$ 表示第 $i$ 个输入数值，$P_i$表示其转换后的概率。
接下来，模型根据这些权重对 Value 向量进行加权求和，就得到了 Self-Attention 的核心公式：

$$
 \operatorname{Attention}(Q,K,V) = \operatorname{softmax}\left( \frac{QK^T}{\sqrt{d_k}}+M \right)V
$$

其中 $M$ 表示 Attention Mask。其作用主要是限制 Attention 的计算范围，后续我们会在 Prefill 部分进行介绍。

对于单个 Token 向量而言，其经过上面的注意力公式计算后输出的结果就是一个融合了更多上下文信息的同形状的向量。

## FFN

经过 Self-Attention 后，每个 Token 的隐藏状态已经融合了来自上下文的信息。但模型不仅需要获取这些信息，还需要进一步学习其中的特征组合与复杂关系。因此，Transformer Block 在 Self-Attention 之后，还会通过 **FFN（Feed-Forward Network，前馈神经网络）** 对隐藏状态进行进一步处理。

与 Self-Attention 不同，FFN 不会直接在不同 Token 之间交换信息，而是对每个 Token 的隐藏向量分别进行计算。其通常由线性变换和非线性激活函数组成。线性变换负责对已有特征进行加权组合，而非线性激活函数则使网络能够学习线性变换难以表达的复杂关系。通过多层变换，FFN 可以对 Self-Attention 聚合后的信息进行进一步加工，形成更加丰富的特征表示。

## Residual Connection

经过 Self-Attention 和 FFN 的计算后，模型会得到新的特征表示。但如果直接使用这些结果替换原有的隐藏状态，就可能使已有信息在多层变换中难以保留，同时增加深层网络的训练难度。

为此，Transformer 引入了 Residual Connection（残差连接），其核心思路是：**不直接使用模块的计算结果替换输入，而是将计算结果与原始输入相加，使模块能够在已有表示的基础上进行更新。**

对于采用 Pre-Norm 结构的 Transformer Block，两次残差连接可以表示为：

$$  
H=X+\operatorname{Attention}(\operatorname{Norm}(X))  \\
\\  
Y=H+\operatorname{FFN}(\operatorname{Norm}(H))  
$$

其中，$X$ 是当前 Transformer Block 的输入隐藏状态，$H$ 是经过 Self-Attention 和第一次残差连接后的隐藏状态，$Y$ 则是当前 Transformer Block 的最终输出。

至此，一个完整的 Transformer Block 就完成了计算。它通过 Self-Attention 聚合上下文信息，通过 FFN 加工特征，再结合归一化和残差连接，不断更新每个 Token 的隐藏状态，并将结果传递给下一层 Transformer Block。多层的 Transformer Block 堆叠起来就形成了完整的 Transformer 网络。

# KV Cache

对于 Decoder-only LLM，生成过程是自回归的，即每生成一个新 Token，都会将新 Token 加入上下文并继续预测下一个 Token。一种直观的实现方式，是每次生成新 Token 后，都将完整的 Token 序列重新输入 Transformer 进行计算。但随着生成过程不断进行，如果每次都重新计算整个序列，会产生大量的重复计算。

实际上，由于因果掩码保证了每个 Token 的隐藏状态只能依赖当前及之前的 Token，因此后续生成的新 Token 不会改变历史 Token已经计算得到的隐藏状态。也就是说，**历史 Token 的计算结果可以被复用，而不需要在每一轮生成时重新计算。** 

基于这一特点，现代 LLM 通常采用 **KV Cache** 机制，将历史 Token 在各层 Attention 中计算得到的 Key 和 Value 保存起来，供后续生成过程使用。之所以只缓存 Key 和 Value，而不缓存 Query，是因为模型在 Decode 阶段只需要计算新加入 Token 的 Query，并将其与历史 Token 的 Key 进行匹配，再对 Value 进行加权求和。历史 Token 的 Query 不会直接参与当前 Token 的注意力计算，因此通常没有必要缓存。

需要注意的是，KV Cache 保存的并不是整个序列的最终隐藏状态，而是每个 Transformer Block 中 Attention 所需的 Key 和 Value。由于不同层具有各自的投影参数，因此每一层都需要维护相应的 KV Cache。

# Prefill & Decode

Prefill 和 Decode 是模型在实际推理过程中的两个不同计算阶段。

Prefill 阶段负责处理已经存在的输入上下文。由于用户提供的完整输入序列在推理开始时就已经确定，模型可以并行处理这些 Token，通过多层 Transformer Block 计算其隐藏状态，并将 Attention 中需要复用的 Key、Value 保存到 KV Cache 中。随后，模型利用最后一个有效位置的隐藏状态预测第一个输出 Token。

需要注意的是在 Prefill 阶段依然会使用因果掩码，使每个 Token 只能关注自己及之前的 Token。因此，即使整个输入序列同时参与计算，各个位置得到的隐藏状态仍然只依赖其已有的上下文。这样才能确保历史 Token的隐藏状态是稳定的，不会因为后续 token 发生变化，以实现 KV Cache 在后续 Decode 阶段的持续复用。

Prefill 完成后，模型已经根据输入上下文预测出了第一个输出 Token。但由于 Decoder-only LLM 采用自回归生成方式，一条完整的回答需要通过多轮预测逐步生成，因此模型还需要继续执行 Decode 阶段。

在 Decode 阶段，模型会将上一轮刚刚生成的 Token 作为当前输入，继续通过 Transformer 计算其隐藏状态，并预测下一个 Token。这个过程与 Prefill 不同，模型不再需要重新处理完整的历史序列，而是通过 KV Cache 复用此前已经计算得到的 Key 和 Value。

具体来说，当前 Token 在每一层 Attention 中都会生成新的 Query、Key 和 Value。其中，Query 会与缓存的历史 Key 以及当前 Key 计算注意力分数，再根据对应的 Value 聚合上下文信息。与此同时，当前 Token 的 Key 和 Value 也会被加入 KV Cache，供后续生成使用。这样，模型每轮只需要处理一个新的 Token，就能够利用已有的上下文信息继续预测。随着新 Token 不断生成，这一过程也会持续重复，直到满足相应的停止条件。

# LM Head

经过多层 Transformer Block 的计算后，模型会得到整个输入序列的最终隐藏状态。对于一个包含 $L$ 个 Token、隐藏维度为 $D$ 的输入序列，其隐藏状态仍然是一个形状为 $[B,L,D]$ 的三维张量。

不过，这些隐藏状态本质上仍然是连续的数值向量，而语言模型最终需要输出的是词表中的某个 Token。因此，模型还需要将隐藏状态转换为词表中各个 Token 的预测分数，这一步就是通过 **LM Head（Language Modeling Head，语言模型输出层）** 完成的。

对于采用自回归生成方式的 Decoder-only LLM，模型需要根据已有上下文预测下一个 Token。由于最后一个有效位置的隐藏状态能够融合此前所有 Token 的上下文信息，因此在实际推理时，通常只需要将这个位置的隐藏向量输入 LM Head。

LM Head 通常由一个线性投影层实现，其计算过程可以表示为：

$$  
Z=HW_{\text{out}}  
$$

其中，$H$ 表示输入 LM Head 的隐藏状态，$W_{\text{out}}$ 是模型训练得到的输出投影矩阵。

假设模型的隐藏维度为 4096，词表大小为 100000，那么 LM Head 就会将一个 4096 维的隐藏向量映射为 100000 维的输出向量。

$$  
[4096]\rightarrow[100000]  
$$

输出向量中的每一个数值，都对应词表中某个 Token 的预测分数，这些分数被称为 **Logits**。

需要注意的是，Logits 并不是概率，它们只表示模型对不同候选 Token 的相对偏好。模型还需要对这些分数进行进一步处理，才能确定最终生成哪个 Token。

# Token Sampling

在得到 LM Head 输出的 Logits 后，模型实际上已经为词表中的每一个 Token 计算了一个预测分数。接下来需要解决的问题是：**如何根据这些分数选择下一个 Token？**

最直接的选择方式是 Greedy Decoding（贪心解码），即直接选取 Logit 最高的 Token。由于不涉及随机选择，在相同上下文和确定性计算条件下，这种方式通常会产生相同的输出。

不过，预测分数最高的 Token 并不一定是唯一合理的选择。为了让模型能够从多个候选中进行选择，也可以采用随机采样策略。在进行随机采样时，模型首先需要将 LM Head 输出的 Logits 转换为概率分布。这里通常使用我们之前在 Self-Attention 中介绍过的 Softmax：

$$  
P_i=\frac{e^{z_i}}{\sum_j e^{z_j}}  
$$

其中，$z_i$ 表示第 $i$ 个 Token 的 Logit，$P_i$ 表示其对应的预测概率。

得到概率分布后，模型便可以按照各个 Token 的概率进行随机采样。概率越高的 Token，被选中的可能性通常也越大。在此基础上，推理服务还可以通过 Temperature、Top-k 和 Top-p 等参数调整概率分布或限制候选范围，从而控制生成结果的随机性与多样性：

| 参数          | 作用                                                    |
| ----------- | ----------------------------------------------------- |
| Temperature | 调整 Logits 对应概率分布的集中程度，越低越倾向高概率 Token；越高则分布越平缓，随机性通常越强 |
| Top-k       | 只保留概率最高的 k 个候选 Token，k 越小，候选范围越窄；k 越大，可选 Token 越多     |
| Top-p       | 保留累计概率达到阈值 p 的最小候选集合，p 越小，候选范围通常越集中；p 越大，允许更多低概率候选参与  |

完成 Token 选择后，模型就得到了新的 Token ID，并将其用于后续 Decode 计算，持续生成后面的内容。
